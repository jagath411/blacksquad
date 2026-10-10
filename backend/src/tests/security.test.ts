/**
 * Security regression tests: one or more cases for each hole found in the October 2026 audit.
 * Run with `npm run test:security` against a database whose name contains "test".
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { BookingModel } from '../models/Booking';
import { DriverModel } from '../models/Driver';
import { UserModel } from '../models/User';
import { VehicleModel } from '../models/Vehicle';
import { createOtpChallenge, shouldExposeDevOtp } from '../services/otp.service';
import { call, collect, connect, makeUser, nextPhone, pause, run, trip, type Json } from './harness';

describe('roles', () => {
  test('public sign-up always creates a customer, even when OWNER is requested', async () => {
    const res = await call('POST', '/auth/register', {
      name: 'Would-be owner',
      email: `wannabe-${run}@security-test.com`,
      password: 'password123',
      role: 'OWNER',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'CUSTOMER');
  });

  test('phone sign-in creates a customer and ignores a requested role', async () => {
    const phone = nextPhone();
    const code = await createOtpChallenge(phone, 'LOGIN');
    const res = await call('POST', '/auth/phone/verify-otp', { phoneNumber: phone, otp: code, role: 'OWNER' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'CUSTOMER');
    assert.ok(res.body.refreshToken);
  });

  test('a customer cannot reach owner analytics or payouts', async () => {
    const customer = await makeUser('CUSTOMER');
    for (const path of ['/analytics/summary', '/analytics/payouts', '/analytics/expenses']) {
      assert.equal((await call('GET', path, undefined, customer.token)).status, 403, path);
    }
    const settle = await call(
      'POST',
      '/analytics/payouts/settle',
      { driverId: new mongoose.Types.ObjectId().toString(), amount: 100, transactionReference: 'TXN-X' },
      customer.token,
    );
    assert.equal(settle.status, 403);
  });
});

describe('bookings', () => {
  test('the server sets the fare; a fare sent by the app is ignored', async () => {
    const customer = await makeUser('CUSTOMER');
    const res = await call('POST', '/bookings', { ...trip, fare: 0 }, customer.token);
    assert.equal(res.status, 201);
    assert.ok(res.body.booking.fare >= 100, `fare was ${res.body.booking.fare}`);
  });

  test('a customer cannot cancel someone else’s booking', async () => {
    const owner = await makeUser('CUSTOMER');
    const stranger = await makeUser('CUSTOMER');
    const created = await call('POST', '/bookings', trip, owner.token);
    const res = await call('PATCH', `/bookings/${created.body.booking._id}/status`, { status: 'CANCELLED' }, stranger.token);
    assert.equal(res.status, 404);
    const stored = await BookingModel.findById(created.body.booking._id).lean();
    assert.equal(stored?.status, 'REQUESTED');
  });

  test('a customer cannot start or complete their own trip', async () => {
    const customer = await makeUser('CUSTOMER');
    const created = await call('POST', '/bookings', trip, customer.token);
    const res = await call('PATCH', `/bookings/${created.body.booking._id}/status`, { status: 'TRIP_COMPLETED' }, customer.token);
    assert.equal(res.status, 403);
  });

  test('the driver never receives the PIN and cannot start the trip without it', async () => {
    const fleetOwner = await makeUser('OWNER');
    const customer = await makeUser('CUSTOMER');
    const driver = await makeUser('DRIVER', fleetOwner.user._id);
    await call('PATCH', '/drivers/me', { availabilityStatus: 'AVAILABLE' }, driver.token);

    const created = await call('POST', '/bookings', trip, customer.token);
    const id = created.body.booking._id;
    const accepted = await call('POST', `/bookings/${id}/accept`, {}, driver.token);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.booking.startOtp, undefined);
    assert.equal(accepted.body.booking.driverId.bankDetails, undefined);

    const active = await call('GET', '/bookings/active', undefined, driver.token);
    assert.equal(active.body.booking.startOtp, undefined);

    const noPin = await call('PATCH', `/bookings/${id}/status`, { status: 'TRIP_STARTED' }, driver.token);
    assert.equal(noPin.status, 400);
    const wrongPin = await call('PATCH', `/bookings/${id}/status`, { status: 'TRIP_STARTED', otp: '0000' }, driver.token);
    assert.equal(wrongPin.status, 400);

    const pin = (await BookingModel.findById(id).lean())!.startOtp;
    const started = await call('PATCH', `/bookings/${id}/status`, { status: 'TRIP_STARTED', otp: pin }, driver.token);
    assert.equal(started.status, 200);
  });

  test('an offline driver cannot accept rides', async () => {
    const customer = await makeUser('CUSTOMER');
    const driver = await makeUser('DRIVER');
    const created = await call('POST', '/bookings', trip, customer.token);
    const res = await call('POST', `/bookings/${created.body.booking._id}/accept`, {}, driver.token);
    assert.equal(res.status, 409);
  });

  test('only a participant can rate a trip, and only once', async () => {
    const customer = await makeUser('CUSTOMER');
    const stranger = await makeUser('CUSTOMER');
    const booking = await BookingModel.create({
      customerId: customer.user._id,
      pickupAddress: 'a1',
      dropAddress: 'b1',
      pickupLocation: { type: 'Point', coordinates: [77.59, 12.97] },
      dropLocation: { type: 'Point', coordinates: [77.6, 12.98] },
      fare: 200,
      status: 'TRIP_COMPLETED',
    });
    assert.equal((await call('POST', `/bookings/${booking._id}/rate`, { rating: 1 }, stranger.token)).status, 409);
    assert.equal((await call('POST', `/bookings/${booking._id}/rate`, { rating: 5 }, customer.token)).status, 200);
    assert.equal((await call('POST', `/bookings/${booking._id}/rate`, { rating: 1 }, customer.token)).status, 409);
  });
});

describe('fleet isolation', () => {
  test('an owner sees only their own vehicles and drivers', async () => {
    const ownerA = await makeUser('OWNER');
    const ownerB = await makeUser('OWNER');
    await makeUser('DRIVER', ownerA.user._id);
    const reg = `KA01SEC${run.slice(-4).toUpperCase()}`;
    assert.equal((await call('POST', '/vehicles', { registrationNumber: reg }, ownerA.token)).status, 201);

    const vehicles = await call('GET', '/vehicles', undefined, ownerB.token);
    assert.equal(vehicles.body.vehicles.length, 0);
    const drivers = await call('GET', '/drivers', undefined, ownerB.token);
    assert.equal(drivers.body.drivers.length, 0);

    const vehicle = await VehicleModel.findOne({ registrationNumber: reg }).lean();
    assert.equal((await call('DELETE', `/vehicles/${vehicle!._id}`, undefined, ownerB.token)).status, 404);
  });

  test('an owner cannot turn someone else’s account into their driver', async () => {
    const fleetOwner = await makeUser('OWNER');
    const customer = await makeUser('CUSTOMER');
    const res = await call('POST', '/drivers', { name: 'Hijack', phoneNumber: customer.user.phoneNumber }, fleetOwner.token);
    assert.equal(res.status, 409);
    assert.equal((await UserModel.findById(customer.user._id).lean())?.role, 'CUSTOMER');

    const otherOwner = await makeUser('OWNER');
    const theirDriver = await makeUser('DRIVER', otherOwner.user._id);
    const steal = await call('POST', '/drivers', { name: 'Steal', phoneNumber: theirDriver.user.phoneNumber }, fleetOwner.token);
    assert.equal(steal.status, 409);
  });

  test('an owner cannot settle a payout for another fleet’s driver', async () => {
    const ownerA = await makeUser('OWNER');
    const ownerB = await makeUser('OWNER');
    const driver = await makeUser('DRIVER', ownerA.user._id);
    const res = await call(
      'POST',
      '/analytics/payouts/settle',
      { driverId: driver.driver!._id.toString(), amount: 1, transactionReference: `TXN-SEC-${run}` },
      ownerB.token,
    );
    assert.equal(res.status, 404);
  });

  test('bank account numbers are encrypted at rest and readable by the driver', async () => {
    const driver = await makeUser('DRIVER');
    const res = await call(
      'PATCH',
      '/drivers/me',
      { bankDetails: { accountNumber: '123456789012', ifscCode: 'HDFC0001234' } },
      driver.token,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.driver.bankDetails.accountNumber, '123456789012');
    const stored = await DriverModel.findById(driver.driver!._id).lean();
    assert.match(stored!.bankDetails!.accountNumber!, /^enc:v1:/);

    const bad = await call('PATCH', '/drivers/me', { bankDetails: { ifscCode: 'NOTANIFSC' } }, driver.token);
    assert.equal(bad.status, 400);
  });
});

describe('sign-in protection', () => {
  test('codes are never exposed outside development', () => {
    assert.equal(shouldExposeDevOtp({ NODE_ENV: 'production', SHOW_DEV_OTP: 'true' }), false);
    assert.equal(shouldExposeDevOtp({ NODE_ENV: 'test', SHOW_DEV_OTP: 'true' }), false);
    assert.equal(shouldExposeDevOtp({ NODE_ENV: 'development', SHOW_DEV_OTP: 'false' }), false);
  });

  test('send-otp never returns the code and refuses when SMS is not configured', async () => {
    const res = await call('POST', '/auth/phone/send-otp', { phoneNumber: nextPhone() });
    assert.equal(res.status, 503);
    assert.equal(res.body.devOtp, undefined);
  });

  test('send-otp does not create an account', async () => {
    const phone = nextPhone();
    await call('POST', '/auth/phone/send-otp', { phoneNumber: phone });
    assert.equal(await UserModel.exists({ phoneNumber: phone }), null);
  });

  test('a code is locked after 5 wrong attempts', async () => {
    const phone = nextPhone();
    const code = await createOtpChallenge(phone, 'LOGIN');
    const wrong = code === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) {
      assert.equal((await call('POST', '/auth/phone/verify-otp', { phoneNumber: phone, otp: wrong })).status, 401);
    }
    const locked = await call('POST', '/auth/phone/verify-otp', { phoneNumber: phone, otp: code });
    assert.equal(locked.status, 429);
  });

  test('repeated wrong passwords are rate limited', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (await call('POST', '/auth/login', { email: `nobody-${run}@security-test.com`, password: 'wrongpass1' })).status;
    }
    assert.equal(last, 429);
  });

  test('refresh tokens rotate, and reusing an old one ends every session', async () => {
    const customer = await makeUser('CUSTOMER');
    const first = await call('POST', '/auth/refresh', { refreshToken: customer.refreshToken });
    assert.equal(first.status, 200);
    const reused = await call('POST', '/auth/refresh', { refreshToken: customer.refreshToken });
    assert.equal(reused.status, 401);
    const afterReuse = await call('POST', '/auth/refresh', { refreshToken: first.body.refreshToken });
    assert.equal(afterReuse.status, 401);
  });

  test('logout revokes the refresh token', async () => {
    const customer = await makeUser('CUSTOMER');
    assert.equal((await call('POST', '/auth/logout', { refreshToken: customer.refreshToken })).status, 200);
    assert.equal((await call('POST', '/auth/refresh', { refreshToken: customer.refreshToken })).status, 401);
  });

  test('a disabled account cannot refresh its session', async () => {
    const customer = await makeUser('CUSTOMER');
    await UserModel.updateOne({ _id: customer.user._id }, { isActive: false });
    assert.equal((await call('POST', '/auth/refresh', { refreshToken: customer.refreshToken })).status, 401);
  });
});

describe('live tracking', () => {
  test('only the trip’s customer and the driver’s owner see the driver move', async () => {
    const fleetOwner = await makeUser('OWNER');
    const otherOwner = await makeUser('OWNER');
    const customer = await makeUser('CUSTOMER');
    const stranger = await makeUser('CUSTOMER');
    const driver = await makeUser('DRIVER', fleetOwner.user._id);
    await call('PATCH', '/drivers/me', { availabilityStatus: 'AVAILABLE' }, driver.token);
    const created = await call('POST', '/bookings', trip, customer.token);
    const bookingId = created.body.booking._id as string;
    assert.equal((await call('POST', `/bookings/${bookingId}/accept`, {}, driver.token)).status, 200);

    const [driverSocket, customerSocket, strangerSocket, ownerSocket, otherOwnerSocket] = await Promise.all([
      connect(driver.token),
      connect(customer.token),
      connect(stranger.token),
      connect(fleetOwner.token),
      connect(otherOwner.token),
    ]);
    customerSocket.emit('booking:join', bookingId);
    strangerSocket.emit('booking:join', bookingId);
    await pause(300);

    const seenByCustomer = collect(customerSocket, 'booking:location:update');
    const seenByStranger = collect(strangerSocket, 'booking:location:update');
    const globalLeak = collect(strangerSocket, 'driver:location:update');
    const seenByOwner = collect(ownerSocket, 'fleet:location');
    const seenByOtherOwner = collect(otherOwnerSocket, 'fleet:location');

    driverSocket.emit('driver:location', {
      latitude: 12.972,
      longitude: 77.595,
      timestamp: Date.now(),
      bookingId: new mongoose.Types.ObjectId().toString(),
    });

    assert.equal((await seenByCustomer).length, 1);
    assert.equal((await seenByStranger).length, 0);
    assert.equal((await globalLeak).length, 0);
    assert.equal((await seenByOwner).length, 1);
    assert.equal((await seenByOtherOwner).length, 0);
  });

  test('a driver’s live room shares status changes without the PIN', async () => {
    const fleetOwner = await makeUser('OWNER');
    const customer = await makeUser('CUSTOMER');
    const driver = await makeUser('DRIVER', fleetOwner.user._id);
    await call('PATCH', '/drivers/me', { availabilityStatus: 'AVAILABLE' }, driver.token);
    const created = await call('POST', '/bookings', trip, customer.token);
    const bookingId = created.body.booking._id as string;

    const driverSocket = await connect(driver.token);
    const statusEvents = collect(driverSocket, 'booking:status:change', 800);
    await call('POST', `/bookings/${bookingId}/accept`, {}, driver.token);
    driverSocket.emit('booking:join', bookingId);
    await pause(200);
    await call('PATCH', `/bookings/${bookingId}/status`, { status: 'DRIVER_ARRIVING' }, driver.token);

    const events = (await statusEvents) as Array<{ booking?: Json }>;
    assert.ok(events.length >= 1);
    for (const event of events) assert.equal(event.booking?.startOtp, undefined);
  });
});
