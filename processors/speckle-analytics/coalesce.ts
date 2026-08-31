/**
 * Runs at most one rewrite per key at a time, and never loses the last one.
 *
 * A processor is handed a document's state on every change, and each rewrite it
 * performs is total — so while one is running, intermediate states can be
 * dropped, but the *newest* one must always be applied. Getting that slightly
 * wrong is not loud: the read model simply stops at an older state and every
 * query afterwards answers confidently with stale numbers.
 *
 * The subtle part is the hand-off. A queued value must be picked up by the run
 * that is already going, and the decision "the queue is empty, I am done" has
 * to happen in the same synchronous step as releasing the key. Any `await`
 * between those two leaves a window where a submission sees a run still in
 * flight, queues itself, and is then never looked at again — which is exactly
 * how a four-revision project ends up with two revisions of analytics.
 */
export class Coalescer<T> {
  private readonly running = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, T>();

  constructor(private readonly work: (key: string, value: T) => Promise<void>) {}

  /** True when no run is in flight and nothing is queued. */
  get idle(): boolean {
    return this.running.size === 0 && this.pending.size === 0;
  }

  /**
   * Queues a value and makes sure it gets processed.
   *
   * Returns the promise of the run that will apply it — which, when a run is
   * already going, is that run.
   */
  submit(key: string, value: T): Promise<void> {
    // Recorded before consulting `running`, so a run that is about to finish
    // either sees this value in its next loop turn or has already released the
    // key and a fresh run starts below.
    this.pending.set(key, value);

    const inFlight = this.running.get(key);
    if (inFlight) return inFlight;

    const run = this.drain(key);
    this.running.set(key, run);

    return run;
  }

  private async drain(key: string): Promise<void> {
    // Yield once so `submit` finishes storing this promise in `running` before
    // the loop can reach the line that deletes it. Without this, work that
    // resolves synchronously would delete the entry first and leave a settled
    // promise behind that no later submission could ever get past.
    await Promise.resolve();

    for (;;) {
      const next = this.pending.get(key);

      if (next === undefined) {
        // No await between the check above and this release: nothing can queue
        // a value that this run then fails to see.
        this.running.delete(key);
        return;
      }

      this.pending.delete(key);

      try {
        await this.work(key, next);
      } catch (error) {
        // A failed rewrite must not hold the key for the life of the process.
        this.running.delete(key);
        throw error;
      }
    }
  }
}
