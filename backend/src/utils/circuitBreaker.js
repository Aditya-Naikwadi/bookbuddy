const logger = require('./logger');

/**
 * Robust Circuit Breaker utility (Opossum pattern compliant)
 */
class CircuitBreaker {
  constructor(actionFn, options = {}) {
    this.actionFn = actionFn;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.name = options.name || 'CircuitBreaker';
    this.fallbackFn = options.fallback || (() => []);

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF-OPEN
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  async fire(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF-OPEN';
        logger.info(`[${this.name}] Circuit transitioning to HALF-OPEN mode. Testing upstream...`);
      } else {
        logger.warn(`[${this.name}] Circuit is OPEN. Fast-failing request with fallback.`);
        return this.fallbackFn(...args);
      }
    }

    try {
      const result = await this.actionFn(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      return this.fallbackFn(...args);
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure(err) {
    this.failureCount++;
    logger.warn(
      `[${this.name}] Request failed (${this.failureCount}/${this.failureThreshold}): ${err.message}`
    );

    if (this.failureCount >= this.failureThreshold || this.state === 'HALF-OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      logger.error(
        `[${this.name}] Failure threshold reached. Circuit tripped to OPEN for ${this.resetTimeoutMs}ms.`
      );
    }
  }
}

module.exports = CircuitBreaker;
