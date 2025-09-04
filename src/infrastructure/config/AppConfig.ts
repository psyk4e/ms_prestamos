import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  authKey: string;
  database: {
    url: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
  };
}

class ConfigService {
  private static instance: AppConfig;

  private constructor() { }

  public static getInstance(): AppConfig {
    if (!ConfigService.instance) {
      ConfigService.instance = {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        authKey: process.env.AUTH_KEY || 'webhook_secret_key_2025',
        database: {
          url: process.env.DATABASE_URL || ''
        },
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutos
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
        },
        cors: {
          allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
        }
      };

      // Validar configuración crítica
      if (!ConfigService.instance.database.url) {
        throw new Error('DATABASE_URL is required');
      }

      if (!ConfigService.instance.authKey) {
        throw new Error('AUTH_KEY is required');
      }
    }

    return ConfigService.instance;
  }
}

export const config = ConfigService.getInstance();