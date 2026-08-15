export interface BankPreset {
  id: string;
  name: string;
  shortName: string;
  logo: string; // Icon / Logo representation
  color: string; // Brand accent color
  ifscPrefix: string;
  defaultBranch: string;
  upiHandles: string[];
}

export const POPULAR_BANKS: BankPreset[] = [
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    shortName: 'HDFC',
    logo: '🏦',
    color: '#004B8D',
    ifscPrefix: 'HDFC0000240',
    defaultBranch: 'MG Road Main Branch, Bengaluru',
    upiHandles: ['@okhdfcbank', '@hdfcbank'],
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    shortName: 'ICICI',
    logo: '💳',
    color: '#F37021',
    ifscPrefix: 'ICIC0000102',
    defaultBranch: 'Indiranagar 100ft Rd Branch',
    upiHandles: ['@icici', '@okicici'],
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    shortName: 'SBI',
    logo: '🏛️',
    color: '#280071',
    ifscPrefix: 'SBIN0000840',
    defaultBranch: 'Koramangala Commercial Hub Branch',
    upiHandles: ['@oksbi', '@sbi'],
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    shortName: 'AXIS',
    logo: '⚡',
    color: '#97144D',
    ifscPrefix: 'UTIB0000456',
    defaultBranch: 'Electronic City Tech Park Branch',
    upiHandles: ['@axisbank', '@okaxis'],
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    shortName: 'KOTAK',
    logo: '💰',
    color: '#ED1C24',
    ifscPrefix: 'KKBK0008080',
    defaultBranch: 'Whitefield Main Campus Branch',
    upiHandles: ['@kotak', '@kaypay'],
  },
  {
    id: 'pnb',
    name: 'Punjab National Bank',
    shortName: 'PNB',
    logo: '🏢',
    color: '#A20F34',
    ifscPrefix: 'PUNB0021900',
    defaultBranch: 'Jayanagar 4th Block Branch',
    upiHandles: ['@pnb', '@paytm'],
  },
  {
    id: 'bob',
    name: 'Bank of Baroda',
    shortName: 'BOB',
    logo: '🌐',
    color: '#F26522',
    ifscPrefix: 'BARB0INDIRA',
    defaultBranch: 'HSR Layout Sector 1 Branch',
    upiHandles: ['@barodampay'],
  },
  {
    id: 'chase',
    name: 'JPMorgan Chase Bank',
    shortName: 'CHASE',
    logo: '🏛️',
    color: '#117ACA',
    ifscPrefix: 'CHAS0US33XX',
    defaultBranch: 'Global Financial Hub Branch',
    upiHandles: ['@chase'],
  },
];

export function getBankInfo(queryNameOrIfsc?: string): BankPreset {
  if (!queryNameOrIfsc) return POPULAR_BANKS[0];
  const normalized = queryNameOrIfsc.trim().toLowerCase();

  const match = POPULAR_BANKS.find(
    (b) =>
      b.name.toLowerCase().includes(normalized) ||
      b.shortName.toLowerCase().includes(normalized) ||
      b.ifscPrefix.toLowerCase().includes(normalized)
  );

  return (
    match || {
      id: 'custom',
      name: queryNameOrIfsc || 'Custom Bank',
      shortName: 'BANK',
      logo: '🏦',
      color: '#2563EB',
      ifscPrefix: 'IFSC0001234',
      defaultBranch: 'City Branch',
      upiHandles: ['@upi'],
    }
  );
}

export function searchBanks(query: string): BankPreset[] {
  if (!query || !query.trim()) return POPULAR_BANKS;
  const q = query.trim().toLowerCase();
  return POPULAR_BANKS.filter(
    (b) => b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q) || b.ifscPrefix.toLowerCase().includes(q)
  );
}
