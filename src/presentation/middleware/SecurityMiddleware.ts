import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { config } from '../../infrastructure/config/AppConfig';
import { logger } from '../../infrastructure/services/CustomLogger';

export class SecurityMiddleware {
  // Rate limiting middleware
  static createRateLimiter() {
    return rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        error: 'Too Many Requests',
        message: `Too many requests from this IP, please try again after ${config.rateLimit.windowMs / 60000} minutes.`,
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Función personalizada para generar la clave de rate limiting
      keyGenerator: (req: Request) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
      },
      // Handler personalizado para cuando se excede el límite
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs / 60000} minutes.`,
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
        });
      }
    });
  }

  // CORS middleware
  static createCorsMiddleware() {
    return cors({
      origin: (origin, callback) => {
        // Permitir requests sin origin (como Postman, aplicaciones móviles, etc.)
        if (!origin) return callback(null, true);

        if (config.cors.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS policy'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-key'],
      exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page']
    });
  }

  // Helmet security middleware
  static createHelmetMiddleware() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  // Compression middleware
  static createCompressionMiddleware(): any {
    return compression({
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024 // Solo comprimir respuestas mayores a 1KB
    });
  }

  // Middleware para logging de requests
  static requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const clientIp = req.ip || req.connection.remoteAddress;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logMessage = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${clientIp} - ${duration}ms`;

      if (config.nodeEnv === 'development') {
        logger.warn('Security middleware blocked request', {
          timestamp: new Date().toISOString(),
          message: logMessage,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
      }
    });

    next();
  };

  // Middleware para manejo de errores
  static errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', error);

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: config.nodeEnv === 'development' ? error.message : 'Something went wrong',
      timestamp: new Date().toISOString()
    });
  };

  // Middleware para rutas no encontradas
  static notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    });
  };
}