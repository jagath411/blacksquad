import { Router } from 'express';
import healthRoutes from './health.routes';

const apiRouter = Router();

// Mount health router
apiRouter.use('/health', healthRoutes);

export default apiRouter;
