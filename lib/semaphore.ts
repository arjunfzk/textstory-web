/**
 * Async semaphore for limiting concurrent video exports.
 *
 * V1: concurrency=1 (one export at a time). V2 will replace with BullMQ.
 * Waiters queue in FIFO order and are released on timeout if the
 * semaphore is not freed in time.
 */

export class Semaphore {
  private permits: number;
  private waiting: Array<{ resolve: (acquired: boolean) => void; timer: ReturnType<typeof setTimeout> }> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquires a permit, waiting up to timeoutMs if none are available.
   * @returns true if acquired, false if timed out.
   */
  async acquire(timeoutMs = 5000): Promise<boolean> {
    if (this.permits > 0) {
      this.permits--;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        // Remove ourselves from the wait queue on timeout
        const idx = this.waiting.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) this.waiting.splice(idx, 1);
        resolve(false);
      }, timeoutMs);

      this.waiting.push({ resolve, timer });
    });
  }

  /** Releases a permit, unblocking the next waiter if any. */
  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      clearTimeout(next.timer);
      next.resolve(true);
    } else {
      this.permits++;
    }
  }
}
