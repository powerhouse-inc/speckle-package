import { describe, expect, it } from "vitest";
import { Coalescer } from "../coalesce.js";

/** A promise you resolve by hand, so a test controls when work finishes. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets queued microtasks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Coalescer", () => {
  it("runs the work for a single submission", async () => {
    const seen: string[] = [];
    const coalescer = new Coalescer<string>((_key, value) => {
      seen.push(value);
      return Promise.resolve();
    });

    await coalescer.submit("doc", "a");

    expect(seen).toStrictEqual(["a"]);
  });

  it("keeps one run per key, and only the newest queued value", async () => {
    const seen: string[] = [];
    const gate = deferred();
    const coalescer = new Coalescer<string>(async (_key, value) => {
      seen.push(value);
      if (value === "a") await gate.promise;
    });

    const first = coalescer.submit("doc", "a");
    await settle();
    expect(seen).toStrictEqual(["a"]);

    // Three more arrive while "a" is still working. Each rewrite is total, so
    // only the last one needs running.
    void coalescer.submit("doc", "b");
    void coalescer.submit("doc", "c");
    void coalescer.submit("doc", "d");

    gate.resolve();
    await first;
    await settle();

    expect(seen).toStrictEqual(["a", "d"]);
  });

  it("does not drop a value that arrives as the queue empties", async () => {
    // The window this class exists for. A submission landing after the loop has
    // taken the last queued value, but before the run finishes, used to be
    // recorded as pending and then never looked at again — the read model kept
    // whatever the second-to-last state said, silently.
    const seen: string[] = [];
    const started: Array<() => void> = [];

    const coalescer = new Coalescer<string>(async (_key, value) => {
      seen.push(value);
      const gate = deferred();
      started.push(gate.resolve);
      await gate.promise;
    });

    const run = coalescer.submit("doc", "first");
    await settle();
    expect(seen).toStrictEqual(["first"]);

    // "second" arrives while "first" is in flight, so it is queued.
    void coalescer.submit("doc", "second");

    // Finish "first". The loop now picks up "second".
    started[0]();
    await settle();
    expect(seen).toStrictEqual(["first", "second"]);

    // "third" arrives while "second" is in flight — the same window again.
    void coalescer.submit("doc", "third");
    started[1]();
    await settle();
    started[2]?.();
    await run;
    await settle();

    expect(seen).toStrictEqual(["first", "second", "third"]);
  });

  it("starts a fresh run once the previous one has drained", async () => {
    const seen: string[] = [];
    const coalescer = new Coalescer<string>((_key, value) => {
      seen.push(value);
      return Promise.resolve();
    });

    await coalescer.submit("doc", "a");
    await coalescer.submit("doc", "b");

    expect(seen).toStrictEqual(["a", "b"]);
  });

  it("keeps keys independent", async () => {
    const seen: string[] = [];
    const gate = deferred();
    const coalescer = new Coalescer<string>(async (key, value) => {
      seen.push(`${key}:${value}`);
      if (key === "slow") await gate.promise;
    });

    const slow = coalescer.submit("slow", "a");
    await coalescer.submit("fast", "b");

    // The fast key finished while the slow one is still blocked.
    expect(seen).toStrictEqual(["slow:a", "fast:b"]);

    gate.resolve();
    await slow;
  });

  it("does not wedge a key when the work throws", async () => {
    const seen: string[] = [];
    const coalescer = new Coalescer<string>((_key, value) => {
      seen.push(value);
      return value === "bad"
        ? Promise.reject(new Error("write failed"))
        : Promise.resolve();
    });

    await expect(coalescer.submit("doc", "bad")).rejects.toThrow("write failed");

    // A failed rewrite must not stop the next one: the read model would stay
    // stale for as long as the process lives.
    await coalescer.submit("doc", "good");

    expect(seen).toStrictEqual(["bad", "good"]);
  });

  it("reports nothing in flight once everything has drained", async () => {
    const coalescer = new Coalescer<string>(() => Promise.resolve());

    await coalescer.submit("doc", "a");

    expect(coalescer.idle).toBe(true);
  });
});
