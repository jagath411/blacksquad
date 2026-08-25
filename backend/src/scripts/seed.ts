import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';

async function seed() {
  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 12);

  // 1. Create or update Owner account (owner@mail.com and owner@gmail.com)
  const ownerEmails = ['owner@mail.com', 'owner@gmail.com'];
  let primaryOwnerId: mongoose.Types.ObjectId | null = null;

  for (const email of ownerEmails) {
    const owner = await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          name: 'Fleet Owner',
          passwordHash,
          role: 'OWNER',
          isActive: true,
        },
      },
      { upsert: true, new: true },
    );
    if (!primaryOwnerId) primaryOwnerId = owner._id as mongoose.Types.ObjectId;
    console.log(`👤 Owner Account Ready: ${email}`);
  }

  // 2. Create or update Driver account (driver@gmail.com)
  const driverUser = await UserModel.findOneAndUpdate(
    { email: 'driver@gmail.com' },
    {
      $set: {
        name: 'Test Driver',
        passwordHash,
        role: 'DRIVER',
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`🚗 Driver User Account Ready: driver@gmail.com`);

  // 3. Create or update Driver Profile with Bank Details
  const driverProfile = await DriverModel.findOneAndUpdate(
    { userId: driverUser._id },
    {
      $set: {
        licenseNumber: 'DL-IND-2026-98765',
        availabilityStatus: 'AVAILABLE',
        bankDetails: {
          accountHolderName: 'Test Driver',
          bankName: 'HDFC BANK',
          accountNumber: '50100492817291',
          ifscCode: 'HDFC0001234',
          branchName: 'Koramangala 4th Block, Bangalore',
          upiId: 'driver.test@okhdfcbank',
        },
        currentLocation: {
          type: 'Point',
          coordinates: [77.5946, 12.9716],
        },
        lastLocationUpdate: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  console.log(`📋 Driver Profile Created/Linked with verified HDFC bank details.`);

  // 4. Create or update Vehicle assigned to this Driver & Owner
  const vehicle = await VehicleModel.findOneAndUpdate(
    { registrationNumber: 'KA-01-EQ-9999' },
    {
      $set: {
        registrationNumber: 'KA-01-EQ-9999',
        vehicleType: 'Fleet Transport Van',
        model: 'Volvo FL Express',
        capacity: 10,
        driverId: driverProfile._id,
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true },
  );

  // Link vehicle to driver profile
  await DriverModel.findByIdAndUpdate(driverProfile._id, {
    $set: { vehicleId: vehicle._id },
  });

  // 5. Seed Completed Bookings across 7 days for realistic analytics
  const { BookingModel } = await import('../models/Booking');
  const now = new Date();
  const sampleFares = [1250, 850, 1950, 1400, 1400];

  for (let i = 0; i < sampleFares.length; i++) {
    const tripDate = new Date(now);
    tripDate.setDate(tripDate.getDate() - (i % 5));

    await BookingModel.create({
      customerId: primaryOwnerId || driverUser._id,
      driverId: driverProfile._id,
      vehicleId: vehicle._id,
      pickupLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
      dropLocation: { type: 'Point', coordinates: [77.6346, 12.9466] },
      pickupAddress: 'MG Road Metro Station, Bangalore',
      dropAddress: 'Electronic City Phase 1, Bangalore',
      serviceTier: 'Fleet Comfort Van',
      status: 'TRIP_COMPLETED',
      fare: sampleFares[i],
      distanceKm: 18.5,
      driverRating: 5,
      riderRating: 5,
      createdAt: tripDate,
      completedAt: tripDate,
    });
  }
  console.log(`📊 Seeded 5 completed trips totaling ₹6,850 for Revenue charts.`);

  // 6. Seed Sample Fuel Expenses
  const { ExpenseModel } = await import('../models/Expense');
  await ExpenseModel.create([
    {
      ownerId: primaryOwnerId || driverUser._id,
      vehicleId: vehicle._id,
      driverId: driverProfile._id,
      category: 'FUEL',
      amount: 2200,
      liters: 24.5,
      odometerKm: 34200,
      receiptNumber: 'HP-99182',
      notes: 'Hindustan Petroleum Koramangala High-Speed Diesel',
      date: new Date(Date.now() - 86400000),
    },
    {
      ownerId: primaryOwnerId || driverUser._id,
      vehicleId: vehicle._id,
      category: 'MAINTENANCE',
      amount: 850,
      receiptNumber: 'SRV-1102',
      notes: 'Brake Pad & Oil Inspection',
      date: new Date(Date.now() - 3 * 86400000),
    },
  ]);
  console.log(`⛽ Seeded sample Fuel & Maintenance expenses for Ledger.`);

  console.log('\n🎉 Seed finished successfully!');
  console.log('-----------------------------------');
  console.log(`OWNER EMAIL:  owner@mail.com (or owner@gmail.com)`);
  console.log(`DRIVER EMAIL: driver@gmail.com`);
  console.log(`PASSWORD:     ${password}`);
  console.log('-----------------------------------');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
