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
      { upsert: true, new: true }
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
    { upsert: true, new: true }
  );
  console.log(`🚗 Driver User Account Ready: driver@gmail.com`);

  // 3. Create or update Driver Profile
  const driverProfile = await DriverModel.findOneAndUpdate(
    { userId: driverUser._id },
    {
      $set: {
        licenseNumber: 'DL-IND-2026-98765',
        availabilityStatus: 'AVAILABLE',
        currentLocation: {
          type: 'Point',
          coordinates: [77.5946, 12.9716],
        },
        lastLocationUpdate: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  console.log(`📋 Driver Profile Created/Linked for user ID: ${driverUser._id}`);

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
    { upsert: true, new: true }
  );

  // Link vehicle to driver profile
  await DriverModel.findByIdAndUpdate(driverProfile._id, {
    $set: { vehicleId: vehicle._id },
  });

  console.log(`🚚 Vehicle KA-01-EQ-9999 assigned to Driver ${driverUser.name}`);

  console.log('\n🎉 Seed finished successfully!');
  console.log('-----------------------------------');
  console.log(`OWNER EMAIL:  owner@mail.com (or owner@gmail.com)`);
  console.log(`DRIVER EMAIL: driver@gmail.com`);
  console.log(`PASSWORD:     ${password}`);
  console.log('-----------------------------------');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
