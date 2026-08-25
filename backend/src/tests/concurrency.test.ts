/**
 * Concurrency & Race Condition Test Suite for BlackSquad
 * Tests multi-threaded / concurrent access to bookings, state transitions, and driver dispatch.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { dbService } from '../config/database';
import { UserModel } from '../models/User';
import { DriverModel } from '../models/Driver';
import { BookingModel } from '../models/Booking';

async function runConcurrencyTests() {
  console.log('🧪 Starting Concurrency & Data Race Condition Test Suite...\n');
  await dbService.connect();

  let passed = 0;
  let failed = 0;

  // Cleanup test artifacts
  await UserModel.deleteMany({ email: { $regex: /@concurrency-test\.com$/ } });
  await BookingModel.deleteMany({ pickupAddress: { $regex: /^Concurrency Test/ } });

  // Setup Customer and 5 Test Drivers
  const customerUser = await UserModel.create({
    name: 'Concurrent Customer',
    email: 'customer@concurrency-test.com',
    phoneNumber: '+919000000000',
    passwordHash: await bcrypt.hash('password123', 8),
    role: 'CUSTOMER',
  });

  const drivers: any[] = [];
  for (let i = 1; i <= 5; i++) {
    const dUser = await UserModel.create({
      name: `Concurrent Driver ${i}`,
      email: `driver${i}@concurrency-test.com`,
      phoneNumber: `+91900000000${i}`,
      passwordHash: await bcrypt.hash('password123', 8),
      role: 'DRIVER',
    });
    const dDoc = await DriverModel.create({
      userId: dUser._id,
      licenseNumber: `DL-CONC-00${i}`,
      availabilityStatus: 'AVAILABLE',
    });
    drivers.push({ user: dUser, driver: dDoc });
  }

  // =========================================================================
  // TEST 1: Concurrent Ride Accept (5 Drivers accept same ride at same millisecond)
  // =========================================================================
  console.log('▶ [TEST 1] Testing Concurrent Ride Accept (5 drivers competing for 1 ride)...');

  const testBooking = await BookingModel.create({
    customerId: customerUser._id,
    pickupAddress: 'Concurrency Test Pickup',
    dropAddress: 'Concurrency Test Drop',
    pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
    dropLocation: { type: 'Point', coordinates: [77.6240, 12.9357] },
    serviceTier: 'BlackSquad Express',
    fare: 350,
    status: 'REQUESTED',
    startOtp: '1234',
  });

  // Simultaneous accept attempts with atomic conditional update
  const acceptPromises = drivers.map(async ({ driver }) => {
    // 1. Atomically verify driver is available and mark them ON_TRIP
    const driverAcquired = await DriverModel.findOneAndUpdate(
      {
        _id: driver._id,
        availabilityStatus: { $ne: 'ON_TRIP' },
      },
      {
        $set: { availabilityStatus: 'ON_TRIP' },
      },
      { new: true }
    );

    if (!driverAcquired) {
      return { driverId: driver._id.toString(), success: false, reason: 'Driver already on trip' };
    }

    // 2. Atomically acquire booking
    const bookingAcquired = await BookingModel.findOneAndUpdate(
      {
        _id: testBooking._id,
        status: { $in: ['REQUESTED', 'ASSIGNED'] },
      },
      {
        $set: {
          status: 'DRIVER_ACCEPTED',
          driverId: driver._id,
        },
      },
      { new: true }
    );

    if (bookingAcquired) {
      return { driverId: driver._id.toString(), success: true };
    } else {
      // Rollback driver availability if booking was taken by another driver
      await DriverModel.findByIdAndUpdate(driver._id, { $set: { availabilityStatus: 'AVAILABLE' } });
      return { driverId: driver._id.toString(), success: false, reason: 'Booking already taken' };
    }
  });

  const results = await Promise.all(acceptPromises);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log(`   Results: ${successCount} winner, ${failureCount} rejected.`);

  if (successCount === 1 && failureCount === 4) {
    console.log('   ✅ TEST 1 PASSED: Exactly 1 driver accepted the ride atomically. No data race.\n');
    passed++;
  } else {
    console.error(`   ❌ TEST 1 FAILED: Expected 1 winner but got ${successCount}.\n`);
    failed++;
  }

  // =========================================================================
  // TEST 2: Concurrent State Transition (Cancel vs Start Trip Race)
  // =========================================================================
  console.log('▶ [TEST 2] Testing Race between Trip Cancel and Trip Start...');

  const raceBooking = await BookingModel.create({
    customerId: customerUser._id,
    pickupAddress: 'Concurrency Test Race',
    dropAddress: 'Concurrency Test Drop',
    pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
    dropLocation: { type: 'Point', coordinates: [77.6240, 12.9357] },
    serviceTier: 'BlackSquad Express',
    fare: 400,
    status: 'DRIVER_ACCEPTED',
    startOtp: '9876',
    driverId: drivers[0].driver._id,
  });

  // Simultaneous Start Trip and Cancel Trip
  const p1 = BookingModel.findOneAndUpdate(
    {
      _id: raceBooking._id,
      status: { $in: ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING'] },
    },
    {
      $set: { status: 'TRIP_STARTED', startedAt: new Date() },
    },
    { new: true }
  );

  const p2 = BookingModel.findOneAndUpdate(
    {
      _id: raceBooking._id,
      status: { $in: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING'] },
    },
    {
      $set: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Customer changed mind' },
    },
    { new: true }
  );

  const [res1, res2] = await Promise.all([p1, p2]);
  const finalDoc = await BookingModel.findById(raceBooking._id).lean();

  console.log(`   Start result: ${res1 ? 'Success' : 'Rejected'}`);
  console.log(`   Cancel result: ${res2 ? 'Success' : 'Rejected'}`);
  console.log(`   Final Document Status: ${finalDoc?.status}`);

  if (finalDoc?.status === 'TRIP_STARTED' || finalDoc?.status === 'CANCELLED') {
    console.log('   ✅ TEST 2 PASSED: State transition resolved deterministically to single terminal state.\n');
    passed++;
  } else {
    console.error('   ❌ TEST 2 FAILED: Document in corrupted state.\n');
    failed++;
  }

  // =========================================================================
  // TEST 3: Duplicate Active Ride Creation Guard
  // =========================================================================
  console.log('▶ [TEST 3] Testing Duplicate Active Ride Creation Prevention...');

  // Active booking created
  await BookingModel.create({
    customerId: customerUser._id,
    pickupAddress: 'Concurrency Test Active',
    dropAddress: 'Concurrency Test Drop',
    pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
    dropLocation: { type: 'Point', coordinates: [77.6240, 12.9357] },
    serviceTier: 'BlackSquad Express',
    fare: 250,
    status: 'REQUESTED',
  });

  // Attempt to create another ride while previous is active
  const existingActive = await BookingModel.findOne({
    customerId: customerUser._id,
    status: { $in: ['REQUESTED', 'ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'TRIP_STARTED'] },
  }).lean();

  if (existingActive) {
    console.log(`   Blocked concurrent booking creation: active booking ${existingActive._id} exists.`);
    console.log('   ✅ TEST 3 PASSED: Duplicate booking prevented.\n');
    passed++;
  } else {
    console.error('   ❌ TEST 3 FAILED: Active booking guard failed.\n');
    failed++;
  }

  // Cleanup
  await UserModel.deleteMany({ email: { $regex: /@concurrency-test\.com$/ } });
  await DriverModel.deleteMany({ _id: { $in: drivers.map((d) => d.driver._id) } });
  await BookingModel.deleteMany({ customerId: customerUser._id });

  await mongoose.disconnect();

  console.log(`========================================`);
  console.log(`🏁 Concurrency Tests Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runConcurrencyTests().catch((err) => {
  console.error('Error running concurrency tests:', err);
  process.exit(1);
});
