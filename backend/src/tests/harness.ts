/** Shared setup for the HTTP and socket test suites: a real server on a random port and a test database. */
import { after, before } from 'node:test';
import http from 'http';
import type { AddressInfo } from 'net';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { createApp } from '../app';
import { dbService } from '../config/database';
import { env } from '../config/env';
import { DriverModel } from '../models/Driver';
import { UserModel } from '../models/User';
import { issueTokens, toAuthUser } from '../services/auth.service';
import { attachSockets } from '../sockets';

if (!/test/i.test(env.MONGODB_URI)) {
  throw new Error('Refusing to run: MONGODB_URI must point at a database whose name contains "test".');
}

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let server: http.Server;
let baseUrl: string;
let socketUrl: string;
const sockets: Socket[] = [];
export const run = Date.now().toString(36);
let phoneSeq = 0;
const phoneBase = 7_000_000_000 + Math.floor(Math.random() * 1e8);
export const nextPhone = () => `+91${phoneBase + phoneSeq++}`;

export async function call(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Json) : {} };
}

export async function makeUser(role: 'OWNER' | 'DRIVER' | 'CUSTOMER', ownerId?: mongoose.Types.ObjectId) {
  const user = await UserModel.create({
    name: `${role} ${run}`,
    email: `${role.toLowerCase()}-${phoneSeq}-${run}@api-test.com`,
    phoneNumber: nextPhone(),
    passwordHash: await bcrypt.hash('password123', 4),
    role,
  });
  const driver = role === 'DRIVER' ? await DriverModel.create({ userId: user._id, ownerId, availabilityStatus: 'OFFLINE' }) : null;
  const { accessToken, refreshToken } = await issueTokens(toAuthUser(user));
  return { user, driver, token: accessToken, refreshToken };
}

export function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connectSocket(socketUrl, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

/** Collects events of one name for a short window. */
export function collect(socket: Socket, event: string, ms = 600): Promise<unknown[]> {
  const seen: unknown[] = [];
  const handler = (payload: unknown) => seen.push(payload);
  socket.on(event, handler);
  return new Promise((resolve) =>
    setTimeout(() => {
      socket.off(event, handler);
      resolve(seen);
    }, ms),
  );
}

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const trip = {
  pickupAddress: 'Security test pickup',
  dropAddress: 'Security test drop',
  pickupCoordinates: [77.5946, 12.9716],
  dropCoordinates: [77.6408, 12.9784],
  serviceTier: 'uberx',
};

before(async () => {
  await dbService.connect();
  await mongoose.connection.db!.dropDatabase();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  server = http.createServer(createApp());
  attachSockets(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  socketUrl = `http://127.0.0.1:${port}`;
  baseUrl = `${socketUrl}${env.API_PREFIX}`;
});

after(async () => {
  sockets.forEach((s) => s.disconnect());
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await dbService.disconnect();
});

