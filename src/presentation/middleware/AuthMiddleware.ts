import { Request, Response, NextFunction } from 'express';
import { config } from '../../infrastructure/config/AppConfig';
import { IWebhookLogService } from '../../domain/interfaces/IWebhookLogService';

export interface AuthenticatedRequest extends Request {
  isAuthenticated?: boolean;
}

export class AuthMiddleware {
  constructor(private readonly webhookLogService: IWebhookLogService) { }

  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authKey = req.headers['x-auth-key'] as string || req.query.authKey as string;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Log del intento de acceso
      const logData = {
        endpoint: req.originalUrl,
        method: req.method,
        ip: clientIp,
        userAgent,
        authKey: authKey ? '***masked***' : undefined,
        success: false,
        response: undefined as any
      };

      if (!authKey) {
        logData.response = { error: 'Auth key is required' };
        await this.webhookLogService.log(logData);

        res.status(401).json({
          error: 'Unauthorized',
          message: 'Auth key is required. Provide it via x-auth-key header or authKey query parameter.',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (authKey !== config.authKey) {
        logData.response = { error: 'Invalid auth key' };
        await this.webhookLogService.log(logData);

        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid auth key provided.',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Autenticación exitosa
      req.isAuthenticated = true;
      logData.success = true;
      logData.response = { message: 'Authentication successful' };
      await this.webhookLogService.log(logData);

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication process failed.',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Middleware opcional para rutas que no requieren autenticación estricta
  optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authKey = req.headers['x-auth-key'] as string || req.query.authKey as string;

    if (authKey && authKey === config.authKey) {
      req.isAuthenticated = true;
    } else {
      req.isAuthenticated = false;
    }

    next();
  };
}