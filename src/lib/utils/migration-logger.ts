/**
 * Migration Logger
 * Phase 2: Basic Error Handling and Logging
 * 
 * Simple logging system for Discord Messages Migration
 * Supports console output and structured error tracking
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  channelId?: string;
  messageId?: string;
  operation?: string;
  duration?: number;
  propertiesReduced?: number;
  [key: string]: unknown;
}

export interface MigrationError {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: Error;
}

export class MigrationLogger {
  private errors: MigrationError[] = [];
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log general information
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log errors
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logEntry: MigrationError = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      error
    };

    // Store for later analysis
    this.errors.push(logEntry);

    // Console output based on log level
    if (this.shouldLog(level)) {
      const formattedMessage = this.formatMessage(logEntry);
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, error);
          break;
      }
    }
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * Format log message for console output
   */
  private formatMessage(entry: MigrationError): string {
    const { level, message, context, timestamp } = entry;
    
    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (context) {
      const contextStr = Object.entries(context)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      
      if (contextStr) {
        formatted += ` | ${contextStr}`;
      }
    }
    
    return formatted;
  }

  /**
   * Get all logged errors for analysis
   */
  getErrors(): MigrationError[] {
    return [...this.errors];
  }

  /**
   * Get errors by level
   */
  getErrorsByLevel(level: LogLevel): MigrationError[] {
    return this.errors.filter(error => error.level === level);
  }

  /**
   * Clear error log
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Get error summary stats
   */
  getSummary(): { [key: string]: number } {
    const summary: { [key: string]: number } = {};
    
    Object.values(LogLevel).forEach(level => {
      summary[level] = this.errors.filter(error => error.level === level).length;
    });
    
    return summary;
  }

  /**
   * Log migration operation timing
   */
  logTiming(operation: string, duration: number, context?: LogContext): void {
    this.info(`${operation} completed`, { 
      ...context, 
      operation, 
      duration: Math.round(duration) 
    });
  }

  /**
   * Log storage reduction metrics
   */
  logReduction(originalProps: number, essentialProps: number, context?: LogContext): void {
    const reduction = ((originalProps - essentialProps) / originalProps * 100).toFixed(1);
    this.info(`Storage reduction: ${reduction}%`, {
      ...context,
      originalProperties: originalProps,
      essentialProperties: essentialProps,
      propertiesReduced: originalProps - essentialProps
    });
  }

  /**
   * Log batch processing progress
   */
  logProgress(processed: number, total: number, context?: LogContext): void {
    const percentage = ((processed / total) * 100).toFixed(1);
    this.info(`Progress: ${processed}/${total} (${percentage}%)`, {
      ...context,
      processed,
      total,
      percentage: Number(percentage)
    });
  }
}

// Export singleton instance for convenience
export const migrationLogger = new MigrationLogger(LogLevel.INFO);