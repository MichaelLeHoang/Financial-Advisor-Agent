const SESSION_DATA_PREFIX = "quanfora.data-cache.v1";

export const SESSION_CACHE_MAX_AGE = {
  onboarding: 8 * 60 * 60 * 1_000,
  account: 30 * 60 * 1_000,
  discovery: 5 * 60 * 1_000,
} as const;

export type SessionSnapshot<T> = {
  version: 1;
  owner: string;
  savedAt: number;
  data: T;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeSegment(value: string) {
  return encodeURIComponent(value.trim() || "guest");
}

export function sessionSnapshotKey(owner: string, key: string) {
  return `${SESSION_DATA_PREFIX}.${safeSegment(owner)}.${safeSegment(key)}`;
}

function browserSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readSessionSnapshot<T>({
  owner,
  key,
  maxAgeMs,
  now = Date.now(),
  storage = browserSessionStorage(),
}: {
  owner: string;
  key: string;
  maxAgeMs: number;
  now?: number;
  storage?: StorageLike | null;
}): SessionSnapshot<T> | null {
  if (!storage || maxAgeMs <= 0) return null;
  const storageKey = sessionSnapshotKey(owner, key);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot<T>>;
    const valid = parsed.version === 1
      && parsed.owner === owner
      && typeof parsed.savedAt === "number"
      && Number.isFinite(parsed.savedAt)
      && "data" in parsed;
    if (!valid || now - parsed.savedAt! > maxAgeMs || parsed.savedAt! > now + 60_000) {
      storage.removeItem(storageKey);
      return null;
    }
    return parsed as SessionSnapshot<T>;
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
    return null;
  }
}

export function writeSessionSnapshot<T>({
  owner,
  key,
  data,
  savedAt = Date.now(),
  storage = browserSessionStorage(),
}: {
  owner: string;
  key: string;
  data: T;
  savedAt?: number;
  storage?: StorageLike | null;
}) {
  if (!storage) return;
  const snapshot: SessionSnapshot<T> = { version: 1, owner, savedAt, data };
  try {
    storage.setItem(sessionSnapshotKey(owner, key), JSON.stringify(snapshot));
  } catch {
    // The live API remains authoritative when storage is full or unavailable.
  }
}

export function removeSessionSnapshot(owner: string, key: string, storage = browserSessionStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(sessionSnapshotKey(owner, key));
  } catch {
    // Ignore restricted storage access.
  }
}

export const SESSION_DATA_STORAGE_PREFIX = `${SESSION_DATA_PREFIX}.`;
