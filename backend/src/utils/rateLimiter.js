/**
 * RateLimiter utility enforcing a minimum delay between API calls.
 */
class RateLimiter {
  constructor(requestsPerSecond = 2) {
    this.minIntervalMs = Math.ceil(1000 / requestsPerSecond) + 50; // Delay with safety buffer
    this.lastRequestTime = 0;
  }

  async acquire() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      const delay = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.lastRequestTime = Date.now();
  }
}

module.exports = RateLimiter;
