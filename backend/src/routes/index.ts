import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import locationRoutes from './location.routes';

const apiRouter = Router();

// Mount health router
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/drivers/location', locationRoutes);

export default apiRouter;
