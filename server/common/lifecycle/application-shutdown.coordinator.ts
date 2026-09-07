import { Injectable, Logger } from '@nestjs/common';

export interface DrainResult {
  drained: boolean;
}

@Injectable()
export class ApplicationShutdownCoordinator {
  private readonly logger = new Logger(ApplicationShutdownCoordinator.name);
  private activeWork = 0;
  private shuttingDown = false;
  private drainWaiters: Array<() => void> = [];

  constructor(private readonly drainTimeoutMs = 5_000) {}

  beginWork(): boolean {
    if (this.shuttingDown) return false;
    this.activeWork += 1;
    return true;
  }

  endWork(): void {
    if (this.activeWork > 0) this.activeWork -= 1;
    if (this.activeWork === 0) {
      for (const resolve of this.drainWaiters.splice(0)) resolve();
    }
  }

  beginShutdown(): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.logger.log(
      `Shutdown started with ${this.activeWork} active work item(s).`,
    );
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.beginShutdown();
    await this.waitForDrain();
  }

  async waitForDrain(): Promise<DrainResult> {
    if (this.activeWork === 0) return { drained: true };
    return new Promise((resolve) => {
      let settled = false;
      const finish = (drained: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.drainWaiters = this.drainWaiters.filter(
          (waiter) => waiter !== onDrained,
        );
        resolve({ drained });
      };
      const onDrained = () => finish(true);
      const timeout = setTimeout(() => finish(false), this.drainTimeoutMs);
      this.drainWaiters.push(onDrained);
    });
  }
}
