/**
 * Graceful shutdown coordinator
 * Handles clean shutdown of all server components
 */

import type { Server } from 'http';
import type { Server as HttpsServer } from 'https';
import winston from 'winston';

export type ShutdownHandler = () => Promise<void> | void;

export class GracefulShutdown {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Register a shutdown handler
   */
  registerHandler(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Register HTTP/HTTPS server for graceful shutdown
   */
  registerServer(server: Server | HttpsServer, name: string): void {
    this.registerHandler(async () => {
      this.logger.info(`Closing ${name} server...`);
      
      return new Promise<void>((resolve, reject) => {
        // Stop accepting new connections
        server.close((err) => {
          if (err) {
            this.logger.error(`Error closing ${name} server:`, err);
            reject(err);
          } else {
            this.logger.info(`${name} server closed`);
            resolve();
          }
        });

        // Force close after timeout
        setTimeout(() => {
          this.logger.warn(`Force closing ${name} server after timeout`);
          resolve();
        }, 10000); // 10 second timeout
      });
    });
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Execute all shutdown handlers in reverse order (LIFO)
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      try {
        await this.handlers[i]();
      } catch (error) {
        this.logger.error('Error during shutdown handler:', error);
      }
    }

    this.logger.info('Graceful shutdown complete');
  }

  /**
   * Setup signal handlers
   */
  setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];

    for (const signal of signals) {
      process.on(signal, () => {
        this.shutdown(signal).then(() => {
          process.exit(0);
        }).catch((error) => {
          this.logger.error('Shutdown failed:', error);
          process.exit(1);
        });
      });
    }

    // Handle uncaught errors without exiting immediately
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      this.shutdown('uncaughtException').then(() => {
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection:', reason);
      this.shutdown('unhandledRejection').then(() => {
        process.exit(1);
      });
    });
  }
}

