/**
 * Circuit breaker for LogicMonitor API
 * Prevents cascading failures by temporarily blocking requests when API is unhealthy
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, requests are blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  successThreshold: number;      // Number of successes to close circuit from half-open
  timeout: number;               // Time in ms before attempting to close circuit
  monitoringWindow: number;      // Time window in ms for counting failures
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private successCount = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;
  private failures: number[] = []; // Timestamps of failures

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - LogicMonitor API is temporarily unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful request
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.failures = [];
      }
    }
  }

  /**
   * Record a failed request
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push(now);

    // Remove failures outside monitoring window
    this.failures = this.failures.filter(
      timestamp => now - timestamp < this.config.monitoringWindow
    );

    // Check if we should open the circuit
    if (this.failures.length >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = now + this.config.timeout;
    }

    // If in half-open state, go back to open
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = now + this.config.timeout;
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== undefined && Date.now() >= this.nextAttemptTime;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker stats
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.successCount = 0;
    this.failures = [];
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }
}

// Default circuit breaker instance for LogicMonitor API
export const logicMonitorCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,           // Open after 5 failures
  successThreshold: 2,           // Close after 2 successes in half-open
  timeout: 60000,                // Wait 60s before trying again
  monitoringWindow: 60000,       // Count failures in 60s window
});

