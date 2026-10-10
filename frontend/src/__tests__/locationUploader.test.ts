const mockApiRequest = jest.fn();
let mockSocket: { connected: boolean; emit: jest.Mock } | null = null;

jest.mock('../services/api/client', () => {
  class ApiError extends Error {
    status: number;
    constructor(code: number, message: string) {
      super(message);
      this.status = code;
    }
  }
  return { ApiError, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});
jest.mock('../services/socket', () => ({ getFleetSocket: () => mockSocket }));

import { ApiError } from '../services/api/client';
import { flushPendingFix, hasPendingFix, uploadFix } from '../services/locationUploader';

const fix = (timestamp: number, accuracy = 10) => ({ latitude: 12.97, longitude: 77.59, accuracy, timestamp });

beforeEach(() => {
  mockApiRequest.mockReset();
  mockSocket = null;
});

describe('location uploader', () => {
  it('uses the socket when it is connected', async () => {
    mockSocket = { connected: true, emit: jest.fn() };
    await uploadFix(fix(1));
    expect(mockSocket.emit).toHaveBeenCalledWith('driver:location', fix(1));
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('falls back to HTTP when the socket is down', async () => {
    mockApiRequest.mockResolvedValue({});
    await uploadFix(fix(2));
    expect(mockApiRequest).toHaveBeenCalledWith('/drivers/location', expect.objectContaining({ method: 'POST' }));
  });

  it('drops fixes that are too imprecise', async () => {
    await uploadFix(fix(3, 500));
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('keeps the newest fix while offline and sends it when back online', async () => {
    mockApiRequest.mockRejectedValue(new ApiError(0, 'offline'));
    await uploadFix(fix(10));
    await uploadFix(fix(11));
    expect(hasPendingFix()).toBe(true);

    mockApiRequest.mockReset();
    mockApiRequest.mockResolvedValue({});
    await flushPendingFix();
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockApiRequest.mock.calls[0][1].body).timestamp).toBe(11);
    expect(hasPendingFix()).toBe(false);
  });
});
