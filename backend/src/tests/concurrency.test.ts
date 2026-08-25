/**
 * End-to-End HTTP Concurrency & Data Race Condition Test Suite for BlackSquad
 * Validates real HTTP network requests under high concurrency load against Express & MongoDB.
 */

process.env.NODE_ENV = 'test';

import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { dbService } from '../config/database';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';
import { BookingModel } from '../models/Booking';
import { PayoutModel } from '../models/Payout';
import { locationState } from '../services/location.service';

const makeToken = (user: { _id: any; email: string; role: string; name?: string }) =>
  jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name || 'Test User',
    },
    env.JWT_SECRET,
    { expiresIn: '2h' }
  );

async function httpPost(url: string, token: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => {
          resData += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, body: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode || 500, body: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function httpPatch(url: string, token: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => {
          resData += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, body: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode || 500, body: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runE2EConcurrencySuite() {
  console.log('🧪 =========================================================');
  console.log('🧪 BlackSquad End-to-End HTTP Concurrency & Race Condition Suite');
  console.log('🧪 =========================================================\n');

  await dbService.connect();

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  console.log(`📡 In-Memory HTTP Test Server listening on ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  // Cleanup past test artifacts
  await UserModel.deleteMany({ email: { $regex: /@e2e-test\.com$/ } });
  await BookingModel.deleteMany({ pickupAddress: { $regex: /^E2E Concurrency/ } });
  await PayoutModel.deleteMany({ transactionReference: { $regex: /^TXN-CONC/ } });

  // 1. Setup Test Customer, Fleet Owner, and 10 Drivers
  const customer = await UserModel.create({
    name: 'E2E Test Customer',
    email: 'customer@e2e-test.com',
    phoneNumber: '+919999900000',
    passwordHash: await bcrypt.hash('password123', 8),
    role: 'CUSTOMER',
  });
  const customerToken = makeToken(customer);

  const owner = await UserModel.create({
    name: 'E2E Fleet Owner',
    email: 'owner@e2e-test.com',
    phoneNumber: '+919999999999',
    passwordHash: await bcrypt.hash('password123', 8),
    role: 'OWNER',
  });
  const ownerToken = makeToken(owner);

  const drivers: Array<{ user: any; driver: any; token: string }> = [];
  for (let i = 1; i <= 10; i++) {
    const dUser = await UserModel.create({
      name: `E2E Driver ${i}`,
      email: `driver${i}@e2e-test.com`,
      phoneNumber: `+9199999000${i < 10 ? '0' + i : i}`,
      passwordHash: await bcrypt.hash('password123', 8),
      role: 'DRIVER',
    });
    const vehicle = await VehicleModel.create({
      registrationNumber: `KA-01-CONC-${1000 + i}`,
      vehicleType: 'SEDAN',
      model: 'Swift Dzire',
      status: 'ACTIVE',
    });
    const dDoc = await DriverModel.create({
      userId: dUser._id,
      licenseNumber: `DL-E2E-00${i}`,
      vehicleId: vehicle._id,
      availabilityStatus: 'AVAILABLE',
      bankDetails: {
        accountHolderName: `E2E Driver ${i}`,
        bankName: 'HDFC Bank',
        accountNumber: `9876543210${i}`,
        ifscCode: 'HDFC0001234',
        upiId: `driver${i}@okhdfcbank`,
      },
    });
    drivers.push({ user: dUser, driver: dDoc, token: makeToken(dUser) });
  }

  // =========================================================================
  // TEST 1: Concurrent HTTP Ride Acceptance (10 Drivers hit accept at exact same time)
  // =========================================================================
  console.log('▶ [TEST 1] Testing HTTP Concurrent Ride Accept (10 Drivers racing via HTTP POST)...');

  const ride1 = await BookingModel.create({
    customerId: customer._id,
    pickupAddress: 'E2E Concurrency Pickup 1',
    dropAddress: 'E2E Concurrency Drop 1',
    pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
    dropLocation: { type: 'Point', coordinates: [77.6240, 12.9357] },
    serviceTier: 'SEDAN',
    fare: 450,
    status: 'REQUESTED',
    startOtp: '1122',
  });

  const acceptResponses = await Promise.all(
    drivers.map((d) => httpPost(`${baseUrl}/bookings/${ride1._id}/accept`, d.token, {}))
  );

  const success200 = acceptResponses.filter((r) => r.status === 200);
  const conflict409 = acceptResponses.filter((r) => r.status === 409);

  console.log(`   HTTP Responses: ${success200.length} 200 OK, ${conflict409.length} 409 Conflict.`);

  const updatedRide1 = await BookingModel.findById(ride1._id).lean();

  if (success200.length === 1 && conflict409.length === 9 && updatedRide1?.status === 'DRIVER_ACCEPTED') {
    console.log('   ✅ TEST 1 PASSED: Exactly 1 driver won the HTTP race. Zero duplicate assignments.\n');
    passed++;
  } else {
    console.error(`   ❌ TEST 1 FAILED: Expected 1x200 and 9x409, got ${success200.length}x200.\n`);
    failed++;
  }

  // =========================================================================
  // TEST 2: Concurrent Duplicate Active Booking Creation (Customer rapid clicks)
  // =========================================================================
  console.log('▶ [TEST 2] Testing HTTP Concurrent Active Booking Creation Guard (5 rapid requests)...');

  // Finish any active bookings first
  await BookingModel.updateMany({ customerId: customer._id }, { $set: { status: 'TRIP_COMPLETED' } });

  const bookingPayload = {
    pickupAddress: 'E2E Concurrency MG Road',
    dropAddress: 'E2E Concurrency Airport',
    pickupCoordinates: [77.5946, 12.9716],
    dropCoordinates: [77.7064, 13.1986],
    serviceTier: 'SEDAN',
    fare: 850,
    distanceKm: 34.2,
  };

  const createResponses = await Promise.all([
    httpPost(`${baseUrl}/bookings`, customerToken, bookingPayload),
    httpPost(`${baseUrl}/bookings`, customerToken, bookingPayload),
    httpPost(`${baseUrl}/bookings`, customerToken, bookingPayload),
    httpPost(`${baseUrl}/bookings`, customerToken, bookingPayload),
    httpPost(`${baseUrl}/bookings`, customerToken, bookingPayload),
  ]);

  const created201 = createResponses.filter((r) => r.status === 201);
  const conflictCreate409 = createResponses.filter((r) => r.status === 409);

  console.log(`   HTTP Responses: ${created201.length} 201 Created, ${conflictCreate409.length} 409 Conflict.`);

  if (created201.length === 1 && conflictCreate409.length === 4) {
    console.log('   ✅ TEST 2 PASSED: Only 1 active booking created. 4 duplicate requests blocked.\n');
    passed++;
  } else {
    console.error(`   ❌ TEST 2 FAILED: Expected 1x201, got ${created201.length}x201.\n`);
    failed++;
  }

  // =========================================================================
  // TEST 3: Competing State Machine Transitions via HTTP (Cancel vs Trip Started)
  // =========================================================================
  console.log('▶ [TEST 3] Testing HTTP Competing State Transitions (Cancel vs Trip Start)...');

  const firstDriver = drivers[0]!;

  const ride3 = await BookingModel.create({
    customerId: customer._id,
    pickupAddress: 'E2E Concurrency Race 3',
    dropAddress: 'E2E Concurrency Drop 3',
    pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
    dropLocation: { type: 'Point', coordinates: [77.6240, 12.9357] },
    serviceTier: 'SEDAN',
    fare: 500,
    status: 'DRIVER_ACCEPTED',
    startOtp: '7788',
    driverId: firstDriver.driver._id,
  });

  const [cancelRes, startRes] = await Promise.all([
    httpPatch(`${baseUrl}/bookings/${ride3._id}/status`, customerToken, {
      status: 'CANCELLED',
      cancellationReason: 'Need to change plans',
    }),
    httpPatch(`${baseUrl}/bookings/${ride3._id}/status`, firstDriver.token, {
      status: 'TRIP_STARTED',
      otp: '7788',
    }),
  ]);

  const finalRide3 = await BookingModel.findById(ride3._id).lean();
  console.log(`   Cancel Status: ${cancelRes.status}, Start Status: ${startRes.status}`);
  console.log(`   Final Document Status: ${finalRide3?.status}`);

  if (
    (finalRide3?.status === 'CANCELLED' || finalRide3?.status === 'TRIP_STARTED') &&
    (cancelRes.status === 200 || startRes.status === 200)
  ) {
    console.log('   ✅ TEST 3 PASSED: State machine resolved atomically to a valid state.\n');
    passed++;
  } else {
    console.error('   ❌ TEST 3 FAILED: State transition anomaly.\n');
    failed++;
  }

  // =========================================================================
  // TEST 4: Concurrent Duplicate Payout Settlement Guard
  // =========================================================================
  console.log('▶ [TEST 4] Testing Concurrent Payout Settlement Idempotency (5 concurrent requests)...');

  // Complete a ride for driver 1 so they have earnings
  await BookingModel.create({
    customerId: customer._id,
    driverId: firstDriver.driver._id,
    pickupAddress: 'E2E Concurrency Payout',
    dropAddress: 'E2E Concurrency Drop',
    pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
    dropLocation: { type: 'Point', coordinates: [77.6240, 12.9357] },
    serviceTier: 'SEDAN',
    fare: 1000,
    status: 'TRIP_COMPLETED',
  });

  const payoutPayload = {
    driverId: firstDriver.driver._id.toString(),
    amount: 500,
    paymentMethod: 'UPI',
    transactionReference: 'TXN-CONC-998877',
    notes: 'Concurrent Settlement Test',
  };

  const payoutResponses = await Promise.all([
    httpPost(`${baseUrl}/analytics/payouts/settle`, ownerToken, payoutPayload),
    httpPost(`${baseUrl}/analytics/payouts/settle`, ownerToken, payoutPayload),
    httpPost(`${baseUrl}/analytics/payouts/settle`, ownerToken, payoutPayload),
    httpPost(`${baseUrl}/analytics/payouts/settle`, ownerToken, payoutPayload),
    httpPost(`${baseUrl}/analytics/payouts/settle`, ownerToken, payoutPayload),
  ]);

  const payout201 = payoutResponses.filter((r) => r.status === 201);
  const payoutRejected = payoutResponses.filter((r) => r.status >= 400);

  console.log(`   HTTP Responses: ${payout201.length} 201 Created, ${payoutRejected.length} Rejected (Balance & Uniqueness Guards).`);

  if (payout201.length === 1 && payoutRejected.length === 4) {
    console.log('   ✅ TEST 4 PASSED: Exactly 1 payout settled. 4 duplicate settlements rejected.\n');
    passed++;
  } else {
    console.error(`   ❌ TEST 4 FAILED: Expected 1x201 and 4 rejected, got ${payout201.length}x201.\n`);
    failed++;
  }

  // =========================================================================
  // TEST 5: High-Frequency Concurrent GPS Location Stream
  // =========================================================================
  console.log('▶ [TEST 5] Testing High-Frequency Driver GPS Location Streaming (20 concurrent updates)...');

  const gpsPromises = [];
  for (let seq = 1; seq <= 20; seq++) {
    gpsPromises.push(
      locationState.update({
        driverId: firstDriver.user._id.toString(),
        driverName: 'E2E Driver 1',
        latitude: 12.9716 + seq * 0.001,
        longitude: 77.5946 + seq * 0.001,
        speed: 35 + (seq % 5),
        heading: 90,
        timestamp: Date.now() + seq * 100,
      })
    );
  }

  const gpsResults = await Promise.all(gpsPromises);
  const acceptedGps = gpsResults.filter((r) => r.accepted);

  console.log(`   Location Updates: ${acceptedGps.length}/20 accepted sequentially without deadlocks.`);

  if (acceptedGps.length === 20) {
    console.log('   ✅ TEST 5 PASSED: Location async mutex queue processed all GPS packets in sequence.\n');
    passed++;
  } else {
    console.error('   ❌ TEST 5 FAILED: Some GPS packets failed or deadlock occurred.\n');
    failed++;
  }

  // Cleanup
  await UserModel.deleteMany({ email: { $regex: /@e2e-test\.com$/ } });
  await VehicleModel.deleteMany({ registrationNumber: { $regex: /^KA-01-CONC/ } });
  await DriverModel.deleteMany({ _id: { $in: drivers.map((d) => d.driver._id) } });
  await BookingModel.deleteMany({ customerId: customer._id });
  await PayoutModel.deleteMany({ transactionReference: { $regex: /^TXN-CONC/ } });

  server.close();
  await mongoose.disconnect();

  console.log('=========================================================');
  console.log(`🏁 E2E HTTP Concurrency Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runE2EConcurrencySuite().catch((err) => {
  console.error('Fatal error in E2E concurrency test suite:', err);
  process.exit(1);
});
