/**
 * Simulates drivers streaming GPS over sockets and measures how fast updates reach their owner.
 * Creates throwaway users, so it only runs against a database whose name contains "test".
 *
 *   npm run load-test -- --url http://localhost:5000 --drivers 200 --seconds 30
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { env } from '../config/env';
import { DriverModel } from '../models/Driver';
import { UserModel } from '../models/User';
import { issueTokens, toAuthUser } from '../services/auth.service';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const url = arg('url', 'http://localhost:5000');
const driverCount = Number(arg('drivers', '200'));
const seconds = Number(arg('seconds', '30'));
const intervalMs = Number(arg('interval', '3000'));

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connectSocket(url, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function main() {
  if (!/test/i.test(env.MONGODB_URI)) throw new Error('MONGODB_URI must point at a database whose name contains "test".');
  await mongoose.connect(env.MONGODB_URI);
  const run = Date.now().toString(36);
  const passwordHash = await bcrypt.hash('load-test', 4);

  const owner = await UserModel.create({ name: 'Load Owner', email: `owner-${run}@load-test.com`, passwordHash, role: 'OWNER' });
  const drivers = await UserModel.insertMany(
    Array.from({ length: driverCount }, (_, i) => ({
      name: `Load Driver ${i}`,
      email: `driver-${i}-${run}@load-test.com`,
      passwordHash,
      role: 'DRIVER',
    })),
  );
  await DriverModel.insertMany(drivers.map((d) => ({ userId: d._id, ownerId: owner._id, availabilityStatus: 'AVAILABLE' })));

  const ownerSocket = await connect((await issueTokens(toAuthUser(owner))).accessToken);
  const latencies: number[] = [];
  ownerSocket.on('fleet:location', (loc: { timestamp: number }) => latencies.push(Date.now() - loc.timestamp));

  const driverSockets = await Promise.all(
    drivers.map(async (d) => connect((await issueTokens(toAuthUser(d))).accessToken)),
  );
  console.log(`Connected ${driverSockets.length} drivers and 1 owner to ${url}`);

  let sent = 0;
  const started = Date.now();
  const timers = driverSockets.map((socket, i) =>
    setInterval(() => {
      socket.emit('driver:location', {
        latitude: 12.97 + (i % 50) * 0.001 + Math.random() * 0.0005,
        longitude: 77.59 + Math.floor(i / 50) * 0.001 + Math.random() * 0.0005,
        speed: 8,
        accuracy: 10,
        timestamp: Date.now(),
      });
      sent += 1;
    }, intervalMs + (i % 10) * 10),
  );

  await new Promise((r) => setTimeout(r, seconds * 1000));
  timers.forEach(clearInterval);
  await new Promise((r) => setTimeout(r, 2000));

  const elapsed = (Date.now() - started) / 1000;
  console.log(`Sent ${sent} updates in ${elapsed.toFixed(0)} s (${(sent / elapsed).toFixed(0)} per second)`);
  console.log(`Owner received ${latencies.length} (${((latencies.length / Math.max(sent, 1)) * 100).toFixed(1)}%)`);
  console.log(`Latency ms: p50 ${percentile(latencies, 50)}, p95 ${percentile(latencies, 95)}, p99 ${percentile(latencies, 99)}`);

  [ownerSocket, ...driverSockets].forEach((s) => s.disconnect());
  await DriverModel.deleteMany({ ownerId: owner._id });
  await UserModel.deleteMany({ email: { $regex: `-${run}@load-test\\.com$` } });
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
