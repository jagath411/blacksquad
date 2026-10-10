import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

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
      logger.info('✅ MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      // Safe error log without exposing credentials
      logger.error({ detail: err instanceof Error ? err.message : 'Unknown error' }, '❌ MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB connection lost. Disconnected from database.');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected successfully');
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
      logger.info('⏳ Connecting to MongoDB...');
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: env.NODE_ENV !== 'production',
      });
      this.isConnecting = false;
      return true;
    } catch (error) {
      this.isConnecting = false;
      logger.error({ detail: error instanceof Error ? error.message : 'Unknown error' }, '❌ Initial MongoDB connection failed');
      // Graceful DB failure handling: do not crash the entire process immediately, allow health endpoint to report status
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        logger.info('🔌 MongoDB disconnected gracefully');
      }
    } catch (error) {
      logger.error({ detail: error instanceof Error ? error.message : 'Unknown error' }, '❌ Error while disconnecting MongoDB');
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
