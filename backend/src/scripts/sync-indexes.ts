/**
 * Builds the database indexes the API depends on. The server does not build them
 * itself in production, so run this after every deploy that changes a model.
 *
 *   npm run db:indexes
 *
 * Needed for: nearest-driver search (2dsphere), sign-in code and session expiry (TTL),
 * and unique refresh tokens and payout references.
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import '../models/Booking';
import '../models/Driver';
import '../models/DriverLocation';
import '../models/Expense';
import '../models/OtpChallenge';
import '../models/Payout';
import '../models/RefreshToken';
import '../models/User';
import '../models/Vehicle';

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  for (const name of mongoose.modelNames()) {
    // createIndexes only adds missing indexes; it never drops any.
    await mongoose.model(name).createIndexes();
    console.log(`Indexes ready: ${name}`);
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
