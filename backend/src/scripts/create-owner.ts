/**
 * Creates a fleet owner, or promotes an existing account to owner.
 * Public sign-up only creates customers, so this is how owners are added.
 *
 *   npm run create-owner -- --name "Ravi Fleet" --phone 9876543210 [--email ravi@example.com]
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { normalizePhoneNumber, phoneNumberVariants } from '../routes/auth.routes';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const name = arg('name');
  const rawPhone = arg('phone');
  const email = arg('email')?.toLowerCase();
  if (!name || (!rawPhone && !email)) {
    console.error('Usage: npm run create-owner -- --name "Owner Name" --phone 9876543210 [--email owner@example.com]');
    process.exit(1);
  }
  const phoneNumber = rawPhone ? normalizePhoneNumber(rawPhone) : undefined;

  await mongoose.connect(env.MONGODB_URI);
  const existing = await UserModel.findOne({
    $or: [
      ...(phoneNumber ? [{ phoneNumber: { $in: phoneNumberVariants(phoneNumber) } }] : []),
      ...(email ? [{ email }] : []),
    ],
  });

  if (existing) {
    if (existing.role === 'DRIVER') {
      console.error(`${existing.name} is a driver. Remove them from their fleet before making them an owner.`);
      process.exit(1);
    }
    existing.role = 'OWNER';
    existing.name = name;
    if (phoneNumber) existing.phoneNumber = phoneNumber;
    await existing.save();
    console.log(`Promoted ${existing.name} (${existing.email}) to OWNER.`);
  } else {
    const user = await UserModel.create({
      name,
      email: email || `owner_${phoneNumber!.replace(/\D/g, '')}@blacksquad.internal`,
      phoneNumber,
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      role: 'OWNER',
    });
    console.log(`Created OWNER ${user.name} (${user.email}). They sign in with phone OTP or Google.`);
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
