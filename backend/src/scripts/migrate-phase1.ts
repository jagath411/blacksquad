/**
 * One-off data migration for the Phase 1 security changes. Safe to run more than once.
 *
 * - Gives every vehicle the owner of its driver, so owners keep seeing their vehicles.
 * - Encrypts driver and payout bank account numbers that are still stored in plain text.
 * - Lists drivers and vehicles with no owner; they no longer appear in any fleet until assigned.
 *
 *   npm run migrate:phase1            (dry run, changes nothing)
 *   npm run migrate:phase1 -- --apply
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { DriverModel } from '../models/Driver';
import { PayoutModel } from '../models/Payout';
import { VehicleModel } from '../models/Vehicle';
import { encryptField } from '../utils/crypto';

const apply = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(apply ? 'Applying migration.' : 'Dry run. Pass --apply to write changes.');

  let vehiclesLinked = 0;
  const vehicles = await VehicleModel.find({ ownerId: { $exists: false } });
  for (const vehicle of vehicles) {
    const driver = vehicle.driverId ? await DriverModel.findById(vehicle.driverId).select('ownerId').lean() : null;
    if (driver?.ownerId) {
      vehiclesLinked += 1;
      if (apply) await VehicleModel.updateOne({ _id: vehicle._id }, { $set: { ownerId: driver.ownerId } });
    } else {
      console.log(`  Vehicle ${vehicle.registrationNumber} has no owner (no driver with an owner).`);
    }
  }
  console.log(`Vehicles given an owner: ${vehiclesLinked}`);

  const orphanDrivers = await DriverModel.find({ ownerId: { $exists: false } }).populate('userId', 'name phoneNumber').lean();
  for (const d of orphanDrivers) {
    const u = d.userId as unknown as { name?: string; phoneNumber?: string } | null;
    console.log(`  Driver ${u?.name ?? d._id} (${u?.phoneNumber ?? 'no phone'}) has no owner.`);
  }
  console.log(`Drivers with no owner: ${orphanDrivers.length}`);

  let driversEncrypted = 0;
  for (const d of await DriverModel.find({ 'bankDetails.accountNumber': { $exists: true, $not: /^enc:v1:/ } })) {
    driversEncrypted += 1;
    if (apply) await DriverModel.updateOne({ _id: d._id }, { $set: { 'bankDetails.accountNumber': encryptField(d.bankDetails?.accountNumber) } });
  }
  let payoutsEncrypted = 0;
  for (const p of await PayoutModel.find({ 'bankDetails.accountNumber': { $exists: true, $not: /^enc:v1:/ } })) {
    payoutsEncrypted += 1;
    if (apply) await PayoutModel.updateOne({ _id: p._id }, { $set: { 'bankDetails.accountNumber': encryptField(p.bankDetails?.accountNumber) } });
  }
  console.log(`Bank account numbers encrypted: ${driversEncrypted} drivers, ${payoutsEncrypted} payouts`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
