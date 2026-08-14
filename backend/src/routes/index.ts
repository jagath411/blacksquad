import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import locationRoutes from './location.routes';
import driverRoutes from './driver.routes';
import vehicleRoutes from './vehicle.routes';

const apiRouter = Router();

// Mount health router
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/drivers/location', locationRoutes);
apiRouter.use('/drivers', driverRoutes);
apiRouter.use('/vehicles', vehicleRoutes);

export default apiRouter;
