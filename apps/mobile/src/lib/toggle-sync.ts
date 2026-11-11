type ToggleSyncOptions<Result> = {
  /** Sends the value to the server */
  send: (value: boolean) => Promise<Result>;
  /** What the server says the value is after `send` */
  read: (result: Result) => boolean;
  /** Puts `value` on screen straight away */
  show: (value: boolean) => void;
  /** The last request matched what's on screen; apply the server's counts */
  settle: (result: Result) => void;
  /** A request failed; `confirmed` is the last value the server agreed to */
  fail: (error: unknown, confirmed: boolean) => void;
};

export type ToggleSync = {
  /**
   * Flips the value. `current` is what the caller last rendered; while a
   * request is out, a second tap can land before that re-renders, so the
   * sync's own value wins then.
   */
  toggle: (current: boolean) => void;
};

/**
 * Keeps one on/off value, like a like or a save, in sync with the server while
 * the user taps as often as they like. Every tap shows at once, but only one
 * request is out at a time: when it comes back, another is sent only if the
 * user has changed their mind since. A failure goes back to the last value the
 * server confirmed.
 */
export function createToggleSync<Result>(options: ToggleSyncOptions<Result>): ToggleSync {
  let inFlight = false;
  let wanted = false;
  let confirmed = false;

  async function flush() {
    inFlight = true;
    for (;;) {
      try {
        const result = await options.send(wanted);
        confirmed = options.read(result);
        if (wanted === confirmed) {
          options.settle(result);
          break;
        }
      } catch (error) {
        wanted = confirmed;
        options.fail(error, confirmed);
        break;
      }
    }
    inFlight = false;
  }

  return {
    toggle(current) {
      if (!inFlight) confirmed = current;
      wanted = inFlight ? !wanted : !current;
      options.show(wanted);
      if (!inFlight) void flush();
    },
  };
}
