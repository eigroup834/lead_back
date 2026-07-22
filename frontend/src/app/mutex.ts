// Tiny async mutex used to serialize token refreshes.
export class Mutex {
  private locked = false;
  private waiters: Array<() => void> = [];

  isLocked(): boolean {
    return this.locked;
  }

  async acquire(): Promise<() => void> {
    while (this.locked) await new Promise<void>((r) => this.waiters.push(r));
    this.locked = true;
    return () => {
      this.locked = false;
      const next = this.waiters.shift();
      if (next) next();
    };
  }

  async wait(): Promise<void> {
    while (this.locked) await new Promise<void>((r) => this.waiters.push(r));
  }
}
