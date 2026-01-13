import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 400) {
      logger.error(message);
      if (req.path.includes('budget')) {
        console.log('Budget request debug - URL:', req.url, 'Path:', req.path, 'BaseURL:', req.baseUrl);
      }
    } else {
      logger.info(message);
    }
  });

  next();
};