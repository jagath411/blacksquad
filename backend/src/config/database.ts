import mongoose from 'mongoose';
import { env } from './env';

export interface DatabaseHealthStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'uninitialized';
  readyState: number;
}

const readyStateMap: Record<number, DatabaseHealthStatus['status']> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

class DatabaseService {
  private static instance: DatabaseService;
  private isConnecting = false;

  private constructor() {
    this.registerMongooseEvents();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private registerMongooseEvents(): void {
    mongoose.connection.on('connected', () => {
      // eslint-disable-next-line no-console
      console.log('✅ MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      // Safe error log without exposing credentials
      // eslint-disable-next-line no-console
      console.error('❌ MongoDB connection error:', err instanceof Error ? err.message : 'Unknown error');
    });

    mongoose.connection.on('disconnected', () => {
      // eslint-disable-next-line no-console
      console.warn('⚠️ MongoDB connection lost. Disconnected from database.');
    });

    mongoose.connection.on('reconnected', () => {
      // eslint-disable-next-line no-console
      console.log('🔄 MongoDB reconnected successfully');
    });
  }

  public async connect(): Promise<boolean> {
    if (mongoose.connection.readyState === 1) {
      return true;
    }

    if (this.isConnecting) {
      return false;
    }

    this.isConnecting = true;

    try {
      // eslint-disable-next-line no-console
      console.log('⏳ Connecting to MongoDB...');
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: env.NODE_ENV !== 'production',
      });
      this.isConnecting = false;
      return true;
    } catch (error) {
      this.isConnecting = false;
      // eslint-disable-next-line no-console
      console.error(
        '❌ Initial MongoDB connection failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      // Graceful DB failure handling: do not crash the entire process immediately, allow health endpoint to report status
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        // eslint-disable-next-line no-console
        console.log('🔌 MongoDB disconnected gracefully');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Error while disconnecting MongoDB:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  public getStatus(): DatabaseHealthStatus {
    const readyState = mongoose.connection.readyState;
    const status = readyStateMap[readyState] ?? 'uninitialized';
    return {
      status,
      readyState,
    };
  }

  public isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }
}

export const dbService = DatabaseService.getInstance();
