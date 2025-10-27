import { randomUUID } from 'crypto';

/**
 * Enum for different log levels with priority ordering
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

/**
 * Interface for log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  traceId: string;
  context?: Record<string, any>;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Interface for logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableSentry: boolean;
  serviceName: string;
  environment: string;
  version: string;
  formatJson: boolean;
  includeStackTrace: boolean;
}

/**
 * Interface for log output handlers
 */
export interface LogOutputHandler {
  handle(entry: LogEntry): Promise<void> | void;
}

/**
 * Console output handler for development and debugging
 */
export class ConsoleOutputHandler implements LogOutputHandler {
  private readonly colors = {
    [LogLevel.DEBUG]: '\x1b[36m', // Cyan
    [LogLevel.INFO]: '\x1b[32m',  // Green
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.FATAL]: '\x1b[35m'  // Magenta
  };

  private readonly reset = '\x1b[0m';

  constructor(private readonly formatJson: boolean = false) { }

  /**
   * Handles console output with colored formatting
   */
  handle(entry: LogEntry): void {
    if (this.formatJson) {
      // Use original console methods to avoid recursion
      process.stdout.write(JSON.stringify(entry, null, 2) + '\n');
      return;
    }

    const color = this.colors[entry.level];
    const levelName = LogLevel[entry.level];
    const prefix = `${color}[${entry.timestamp}] ${levelName}${this.reset}`;

    let output = `${prefix} [${entry.traceId}] ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    // Use process.stdout to avoid console.log recursion
    process.stdout.write(output + '\n');
  }
}

/**
 * File output handler for persistent logging
 */
export class FileOutputHandler implements LogOutputHandler {
  constructor(private readonly filePath: string) { }

  /**
   * Handles file output (placeholder for future implementation)
   */
  async handle(entry: LogEntry): Promise<void> {
    // TODO: Implement file logging with rotation
    // For now, we'll use a simple approach
    const fs = await import('fs/promises');
    const logLine = JSON.stringify(entry) + '\n';

    try {
      await fs.appendFile(this.filePath, logLine);
    } catch (error) {
      // Fallback to stdout if file writing fails
      process.stderr.write(`Failed to write to log file: ${error}\n`);
    }
  }
}

/**
 * Sentry output handler for error tracking and monitoring
 */
export class SentryOutputHandler implements LogOutputHandler {
  /**
   * Handles Sentry output for error levels and above
   */
  handle(entry: LogEntry): void {
    // Only send WARN, ERROR, and FATAL to Sentry
    if (entry.level < LogLevel.WARN) {
      return;
    }

    try {
      const Sentry = require('@sentry/node');

      Sentry.withScope((scope: any) => {
        scope.setTag('log.level', LogLevel[entry.level]);
        scope.setTag('trace.id', entry.traceId);

        if (entry.context) {
          scope.setContext('log_context', entry.context);
        }

        if (entry.metadata) {
          scope.setContext('log_metadata', entry.metadata);
        }

        if (entry.error) {
          Sentry.captureException(entry.error);
        } else {
          Sentry.captureMessage(entry.message, entry.level >= LogLevel.ERROR ? 'error' : 'warning');
        }
      });
    } catch (error) {
      // Fallback if Sentry is not available
      process.stderr.write(`Sentry logging failed: ${error}\n`);
    }
  }
}

/**
 * Custom Logger class that provides structured logging without modifying global console
 */
export class CustomLogger {
  private readonly config: LoggerConfig;
  private readonly outputHandlers: LogOutputHandler[] = [];
  private readonly serviceName: string;
  private readonly environment: string;
  private readonly version: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    // Default configuration
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableSentry: false,
      serviceName: 'ms-prestamos',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      formatJson: false,
      includeStackTrace: true,
      ...config
    };

    this.serviceName = this.config.serviceName;
    this.environment = this.config.environment;
    this.version = this.config.version;

    this.initializeOutputHandlers();
  }

  /**
   * Initialize output handlers based on configuration
   */
  private initializeOutputHandlers(): void {
    if (this.config.enableConsole) {
      this.outputHandlers.push(new ConsoleOutputHandler(this.config.formatJson));
    }

    if (this.config.enableFile) {
      const logPath = process.env.LOG_FILE_PATH || './logs/app.log';
      this.outputHandlers.push(new FileOutputHandler(logPath));
    }

    if (this.config.enableSentry) {
      this.outputHandlers.push(new SentryOutputHandler());
    }
  }

  /**
   * Creates a structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      traceId: randomUUID(),
      context,
      error,
      metadata: {
        service: this.serviceName,
        environment: this.environment,
        version: this.version,
        ...metadata
      }
    };
  }

  /**
   * Internal logging method that handles all log levels
   */
  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Check if log level meets minimum threshold
    if (level < this.config.level) {
      return;
    }

    const entry = this.createLogEntry(level, message, context, error, metadata);

    // Send to all configured output handlers
    const promises = this.outputHandlers.map(handler => {
      try {
        return handler.handle(entry);
      } catch (error) {
        // Prevent logging errors from crashing the application
        process.stderr.write(`Logger handler error: ${error}\n`);
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Log debug messages (lowest priority)
   */
  async debug(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context, undefined, metadata);
  }

  /**
   * Log informational messages
   */
  async info(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, message, context, undefined, metadata);
  }

  /**
   * Log warning messages
   */
  async warn(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARN, message, context, undefined, metadata);
  }

  /**
   * Log error messages
   */
  async error(message: string, error?: Error, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.ERROR, message, context, error, metadata);
  }

  /**
   * Log fatal messages (highest priority)
   */
  async fatal(message: string, error?: Error, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.FATAL, message, context, error, metadata);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): CustomLogger {
    const childLogger = new CustomLogger(this.config);

    // Override the createLogEntry method to include parent context
    const originalCreateLogEntry = childLogger.createLogEntry.bind(childLogger);
    childLogger.createLogEntry = (level, message, entryContext, error, metadata) => {
      const mergedContext = { ...context, ...entryContext };
      return originalCreateLogEntry(level, message, mergedContext, error, metadata);
    };

    return childLogger;
  }

  /**
   * Update logger configuration at runtime
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    Object.assign(this.config, newConfig);

    // Reinitialize output handlers if needed
    this.outputHandlers.length = 0;
    this.initializeOutputHandlers();
  }

  /**
   * Get current logger configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Flush all pending log operations
   */
  async flush(): Promise<void> {
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Default logger instance for the application
 */
export const logger = new CustomLogger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
  enableSentry: process.env.NODE_ENV === 'production',
  formatJson: process.env.LOG_FORMAT === 'json'
});

/**
 * Factory function to create loggers for specific modules
 */
export function createLogger(moduleName: string, config?: Partial<LoggerConfig>): CustomLogger {
  return new CustomLogger({
    ...config,
    serviceName: `ms-prestamos-${moduleName}`
  });
}

/**
 * Utility function to replace console.log usage in existing code
 * This provides a drop-in replacement that maintains the same API
 */
export const loggerUtils = {
  /**
   * Drop-in replacement for console.log
   */
  log: (message: any, ...args: any[]) => {
    const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
    const context = args.length > 0 ? { additionalArgs: args } : undefined;
    logger.info(fullMessage, context);
  },

  /**
   * Drop-in replacement for console.error
   */
  error: (message: any, ...args: any[]) => {
    const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
    const context = args.length > 0 ? { additionalArgs: args } : undefined;
    const error = args.find(arg => arg instanceof Error);
    logger.error(fullMessage, error, context);
  },

  /**
   * Drop-in replacement for console.warn
   */
  warn: (message: any, ...args: any[]) => {
    const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
    const context = args.length > 0 ? { additionalArgs: args } : undefined;
    logger.warn(fullMessage, context);
  },

  /**
   * Drop-in replacement for console.debug
   */
  debug: (message: any, ...args: any[]) => {
    const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
    const context = args.length > 0 ? { additionalArgs: args } : undefined;
    logger.debug(fullMessage, context);
  }
};