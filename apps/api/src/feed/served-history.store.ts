import { Injectable } from '@nestjs/common';

// Which itineraries each feed session has been served.
export interface ServedHistoryStore {
  get(sessionId: string): Promise<ReadonlySet<string>>;
  add(sessionId: string, itineraryIds: readonly string[]): Promise<void>;
}

export const SERVED_HISTORY_STORE = Symbol('SERVED_HISTORY_STORE');

const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 10_000;

// Lives in process memory, so history is lost on restart and not shared between API
// instances. TODO: move to Redis or Postgres before running more than one instance.
@Injectable()
export class InMemoryServedHistoryStore implements ServedHistoryStore {
  // Map keeps insertion order and sessions are re-inserted on every write, so the
  // first entry is always the least recently used.
  private readonly sessions = new Map<
    string,
    { ids: Set<string>; expiresAt: number }
  >();

  get(sessionId: string): Promise<ReadonlySet<string>> {
    return Promise.resolve(new Set(this.liveSession(sessionId)?.ids));
  }

  add(sessionId: string, itineraryIds: readonly string[]): Promise<void> {
    const ids = this.liveSession(sessionId)?.ids ?? new Set<string>();
    itineraryIds.forEach((id) => ids.add(id));

    this.sessions.delete(sessionId);
    this.sessions.set(sessionId, {
      ids,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    for (const oldest of this.sessions.keys()) {
      if (this.sessions.size <= MAX_SESSIONS) break;
      this.sessions.delete(oldest);
    }
    return Promise.resolve();
  }

  private liveSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session && session.expiresAt > Date.now() ? session : undefined;
  }
}
