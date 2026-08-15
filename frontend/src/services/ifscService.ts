import { ALL_INDIAN_BANKS, findBankByCodeOrName, type IndianBankData } from '../utils/allIndianBanks';

export interface RazorpayIfscResponse {
  BANK: string;
  BANKCODE: string;
  IFSC: string;
  BRANCH: string;
  ADDRESS: string;
  CITY: string;
  DISTRICT: string;
  STATE: string;
  MICR?: string;
  CONTACT?: string;
  UPI?: boolean;
  NEFT?: boolean;
  IMPS?: boolean;
  RTGS?: boolean;
}

export interface VerifiedIfscResult {
  ifsc: string;
  bankName: string;
  branchName: string;
  address: string;
  city: string;
  state: string;
  micr?: string;
  upiSupported: boolean;
  bankMeta?: IndianBankData;
  logoUrl?: string;
  brandColor: string;
}

const ifscCache = new Map<string, VerifiedIfscResult>();

export function isValidIfscFormat(code: string): boolean {
  if (!code) return false;
  const clean = code.trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean);
}

export async function lookupIfscCode(ifsc: string): Promise<VerifiedIfscResult | null> {
  const cleanIfsc = ifsc.trim().toUpperCase();
  if (!isValidIfscFormat(cleanIfsc)) return null;

  if (ifscCache.has(cleanIfsc)) {
    return ifscCache.get(cleanIfsc)!;
  }

  try {
    const res = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`);
    if (!res.ok) return null;

    const data = (await res.json()) as RazorpayIfscResponse;

    // Match bank by 4-letter prefix (BANKCODE) or BANK name
    const matchedBank = findBankByCodeOrName(data.BANKCODE) || findBankByCodeOrName(data.BANK);

    const result: VerifiedIfscResult = {
      ifsc: data.IFSC,
      bankName: data.BANK || matchedBank?.name || 'Indian Bank',
      branchName: `${data.BRANCH} Branch`,
      address: data.ADDRESS,
      city: data.CITY,
      state: data.STATE,
      micr: data.MICR,
      upiSupported: data.UPI ?? true,
      bankMeta: matchedBank,
      logoUrl: matchedBank?.logoUrl,
      brandColor: matchedBank?.brandColor || '#2563EB',
    };

    ifscCache.set(cleanIfsc, result);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[IFSC Service] Failed to lookup IFSC:', error);

    // Local fallback matching by 4-letter prefix
    const prefix = cleanIfsc.slice(0, 4);
    const matchedBank = findBankByCodeOrName(prefix);
    if (!matchedBank) return null;

    return {
      ifsc: cleanIfsc,
      bankName: matchedBank.name,
      branchName: matchedBank.defaultBranch,
      address: matchedBank.defaultBranch,
      city: 'India',
      state: 'India',
      upiSupported: true,
      bankMeta: matchedBank,
      logoUrl: matchedBank.logoUrl,
      brandColor: matchedBank.brandColor,
    };
  }
}
