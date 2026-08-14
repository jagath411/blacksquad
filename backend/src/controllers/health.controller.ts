import { Request, Response } from 'express';
import { env } from '../config/env';
import { dbService } from '../config/database';

export interface HealthResponse {
  success: boolean;
  message: string;
  environment: string;
  timestamp: string;
  apiStatus: string;
  database: {
    status: string;
  };
  uptime: number;
}

export const getHealth = (_req: Request, res: Response): void => {
  const dbHealth = dbService.getStatus();
  const isHealthy = true; // API itself is functional

  const responsePayload: HealthResponse = {
    success: isHealthy,
    message: 'BlackSquad API service is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    apiStatus: 'healthy',
    database: {
      status: dbHealth.status,
    },
    uptime: Math.floor(process.uptime()),
  };

  res.status(200).json(responsePayload);
};
