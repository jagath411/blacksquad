import type { Types } from 'mongoose';
import { DriverModel } from '../models/Driver';
import { decryptField, encryptField } from '../utils/crypto';
import type { BankDetails } from '../models/Driver';

/** Driver profile ids (Driver._id) that belong to an owner's fleet. */
export async function ownerDriverIds(ownerId: string): Promise<Types.ObjectId[]> {
  return DriverModel.find({ ownerId }).distinct('_id');
}

/** User ids of the drivers in an owner's fleet, as strings (what live location is keyed by). */
export async function ownerDriverUserIds(ownerId: string): Promise<Set<string>> {
  const ids: Types.ObjectId[] = await DriverModel.find({ ownerId }).distinct('userId');
  return new Set(ids.map((id) => id.toString()));
}

export function sealBankDetails(details: BankDetails | undefined): BankDetails | undefined {
  if (!details) return details;
  return { ...details, accountNumber: encryptField(details.accountNumber) };
}

export function openBankDetails(details: BankDetails | undefined): BankDetails | undefined {
  if (!details) return details;
  return { ...details, accountNumber: decryptField(details.accountNumber) };
}
