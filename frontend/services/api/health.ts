import type { HealthResponse } from '../../types';
import { apiRequest } from './client';
export const getHealth=()=>apiRequest<HealthResponse>('/health');
