/**
 * Trip flow tests: quotes, dispatch to nearby drivers and expiry of unanswered requests.
 * Run with `npm run test:api` against a database whose name contains "test".
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BookingModel } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { DriverLocationModel } from '../models/DriverLocation';
import { expireUnansweredRequests, REQUEST_TIMEOUT_MS } from '../services/dispatch.service';
import { NotificationService } from '../services/notification.service';
import { UserModel } from '../models/User';
import { call, collect, connect, makeUser, trip } from './harness';

/** Puts a driver online at a position with a fresh GPS fix. */
async function placeDriver(driverId: unknown, lng: number, lat: number) {
  await DriverModel.updateOne(
    { _id: driverId },
    {
      $set: {
        availabilityStatus: 'AVAILABLE',
        currentLocation: { type: 'Point', coordinates: [lng, lat] },
        lastLocationUpdate: new Date(),
      },
    },
  );
}

describe('quotes', () => {
  test('every tier is priced from the trip distance', async () => {
    const customer = await makeUser('CUSTOMER');
    const res = await call('POST', '/bookings/quote', {
      pickupCoordinates: trip.pickupCoordinates,
      dropCoordinates: trip.dropCoordinates,
    }, customer.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.quotes.length, 3);
    for (const quote of res.body.quotes) {
      assert.ok(quote.fare > 0);
      assert.ok(quote.distanceKm > 0);
    }

    const booked = await call('POST', '/bookings', { ...trip, serviceTier: 'comfort' }, customer.token);
    const comfort = res.body.quotes.find((q: { tier: string }) => q.tier === 'comfort');
    assert.equal(booked.body.booking.fare, comfort.fare);
  });
});

describe('dispatch', () => {
  test('a new ride is offered only to online drivers near the pickup', async () => {
    const near = await makeUser('DRIVER');
    const far = await makeUser('DRIVER');
    const offline = await makeUser('DRIVER');
    // Pickup is at [77.5946, 12.9716]. "far" is about 30 km away.
    await placeDriver(near.driver!._id, 77.6, 12.975);
    await placeDriver(far.driver!._id, 77.85, 12.9716);
    await placeDriver(offline.driver!._id, 77.595, 12.972);
    await DriverModel.updateOne({ _id: offline.driver!._id }, { availabilityStatus: 'OFFLINE' });

    const [nearSocket, farSocket, offlineSocket] = await Promise.all([
      connect(near.token),
      connect(far.token),
      connect(offline.token),
    ]);
    const seenNear = collect(nearSocket, 'booking:new:request', 800);
    const seenFar = collect(farSocket, 'booking:new:request', 800);
    const seenOffline = collect(offlineSocket, 'booking:new:request', 800);

    const customer = await makeUser('CUSTOMER');
    const res = await call('POST', '/bookings', trip, customer.token);
    assert.equal(res.status, 201);
    assert.ok(res.body.driversNotified >= 1);

    assert.equal((await seenNear).length, 1);
    assert.equal((await seenFar).length, 0);
    assert.equal((await seenOffline).length, 0);
  });

  test('other drivers are told when a ride is taken', async () => {
    const first = await makeUser('DRIVER');
    const second = await makeUser('DRIVER');
    await placeDriver(first.driver!._id, 77.5947, 12.9717);
    await placeDriver(second.driver!._id, 77.5948, 12.9718);
    const secondSocket = await connect(second.token);
    const taken = collect(secondSocket, 'booking:request:taken', 800);

    const customer = await makeUser('CUSTOMER');
    const created = await call('POST', '/bookings', trip, customer.token);
    await call('POST', `/bookings/${created.body.booking._id}/accept`, {}, first.token);

    const events = (await taken) as Array<{ bookingId: string }>;
    assert.ok(events.some((e) => e.bookingId === created.body.booking._id));
  });

  test('a request nobody accepts is cancelled and the customer is told', async () => {
    const customer = await makeUser('CUSTOMER');
    const created = await call('POST', '/bookings', trip, customer.token);
    const customerSocket = await connect(customer.token);
    const statusEvents = collect(customerSocket, 'booking:status:change', 800);

    await expireUnansweredRequests(Date.now() + REQUEST_TIMEOUT_MS + 1000);

    const stored = await BookingModel.findById(created.body.booking._id).lean();
    assert.equal(stored?.status, 'CANCELLED');
    assert.equal(stored?.cancellationReason, 'No drivers available nearby');
    const events = (await statusEvents) as Array<{ status: string }>;
    assert.ok(events.some((e) => e.status === 'CANCELLED'));
  });

  test('a driver can drop an accepted trip and goes back online', async () => {
    const driver = await makeUser('DRIVER');
    await placeDriver(driver.driver!._id, 77.5946, 12.9716);
    const customer = await makeUser('CUSTOMER');
    const created = await call('POST', '/bookings', trip, customer.token);
    const id = created.body.booking._id;
    await call('POST', `/bookings/${id}/accept`, {}, driver.token);

    const res = await call('PATCH', `/bookings/${id}/status`, { status: 'CANCELLED' }, driver.token);
    assert.equal(res.status, 200);
    const profile = await DriverModel.findById(driver.driver!._id).lean();
    assert.equal(profile?.availabilityStatus, 'AVAILABLE');
  });

  test('background GPS sent over HTTP reaches the rider like socket updates do', async () => {
    const driver = await makeUser('DRIVER');
    await placeDriver(driver.driver!._id, 77.5946, 12.9716);
    const customer = await makeUser('CUSTOMER');
    const created = await call('POST', '/bookings', trip, customer.token);
    const id = created.body.booking._id;
    await call('POST', `/bookings/${id}/accept`, {}, driver.token);

    const customerSocket = await connect(customer.token);
    customerSocket.emit('booking:join', id);
    await new Promise((r) => setTimeout(r, 200));
    const seen = collect(customerSocket, 'booking:location:update', 800);
    const res = await call('POST', '/drivers/location', { latitude: 12.973, longitude: 77.596, timestamp: Date.now() }, driver.token);
    assert.equal(res.status, 202);
    assert.equal((await seen).length, 1);
  });

  test('rapid GPS fixes are all accepted but stored at most every 15 seconds', async () => {
    const driver = await makeUser('DRIVER');
    for (let i = 0; i < 5; i++) {
      const res = await call(
        'POST',
        '/drivers/location',
        { latitude: 12.9716 + i * 0.00001, longitude: 77.5946, timestamp: Date.now() + i },
        driver.token,
      );
      assert.equal(res.status, 202);
    }
    const stored = await DriverLocationModel.countDocuments({ driverId: driver.driver!._id });
    assert.equal(stored, 1);
  });
});

describe('ride offers from notifications', () => {
  test('a driver can open a waiting ride without seeing the PIN or rider, and not after it is taken', async () => {
    const driver = await makeUser('DRIVER');
    await placeDriver(driver.driver!._id, 77.5946, 12.9716);
    const customer = await makeUser('CUSTOMER');
    const created = await call('POST', '/bookings', trip, customer.token);
    const id = created.body.booking._id;

    const open = await call('GET', `/bookings/${id}/offer`, undefined, driver.token);
    assert.equal(open.status, 200);
    assert.equal(open.body.offer._id, id);
    assert.equal(open.body.offer.startOtp, undefined);
    assert.equal(open.body.offer.customerId, undefined);

    await call('POST', `/bookings/${id}/accept`, {}, driver.token);
    const taken = await call('GET', `/bookings/${id}/offer`, undefined, driver.token);
    assert.equal(taken.body.offer, null);

    const asCustomer = await call('GET', `/bookings/${id}/offer`, undefined, customer.token);
    assert.equal(asCustomer.status, 403);
  });
});

describe('push notifications', () => {
  test('a rider gets a push with the trip id, and dead tokens are forgotten', async () => {
    const customer = await makeUser('CUSTOMER');
    await UserModel.updateOne({ _id: customer.user._id }, { pushToken: 'ExponentPushToken[test-device]' });

    const sent: unknown[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      sent.push(...JSON.parse(init.body));
      return new Response(JSON.stringify({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    try {
      await new NotificationService(true).notifyRider(customer.user.id, 'booking-1', 'DRIVER_ACCEPTED', { driverName: 'Ravi' });
    } finally {
      globalThis.fetch = realFetch;
    }

    assert.equal(sent.length, 1);
    const message = sent[0] as { to: string; title: string; data: { bookingId: string } };
    assert.equal(message.to, 'ExponentPushToken[test-device]');
    assert.equal(message.title, 'Driver on the way');
    assert.equal(message.data.bookingId, 'booking-1');
    const stored = await UserModel.findById(customer.user._id).lean();
    assert.equal(stored?.pushToken, undefined);
  });

  test('signing out stops notifications to that phone', async () => {
    const customer = await makeUser('CUSTOMER');
    await call('POST', '/auth/push-token', { pushToken: 'ExponentPushToken[phone-a]' }, customer.token);
    await call('POST', '/auth/logout', { refreshToken: customer.refreshToken });
    const stored = await UserModel.findById(customer.user._id).lean();
    assert.equal(stored?.pushToken, undefined);
  });
});

