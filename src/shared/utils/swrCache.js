const memory = new Map();
const pending = new Map();

const now = () => Date.now();

export function getSWRValue(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  const current = now();
  return {
    data: entry.data,
    isFresh: entry.freshUntil > current,
    isStale: entry.staleUntil > current,
  };
}

export async function fetchSWR(key, loader, { freshMs = 30_000, staleMs = 300_000, onStale } = {}) {
  const cached = getSWRValue(key);
  if (cached?.isFresh) return cached.data;

  if (cached?.isStale) {
    onStale?.(cached.data);
    if (!pending.has(key)) {
      pending.set(
        key,
        Promise.resolve()
          .then(loader)
          .then((data) => {
            memory.set(key, {
              data,
              freshUntil: now() + freshMs,
              staleUntil: now() + staleMs,
            });
            return data;
          })
          .finally(() => pending.delete(key))
      );
    }
    return cached.data;
  }

  if (pending.has(key)) return pending.get(key);

  const request = Promise.resolve()
    .then(loader)
    .then((data) => {
      memory.set(key, {
        data,
        freshUntil: now() + freshMs,
        staleUntil: now() + staleMs,
      });
      return data;
    })
    .finally(() => pending.delete(key));

  pending.set(key, request);
  return request;
}

export function clearSWR(keyPrefix = '') {
  if (!keyPrefix) {
    memory.clear();
    pending.clear();
    return;
  }
  Array.from(memory.keys()).forEach((key) => {
    if (String(key).startsWith(keyPrefix)) memory.delete(key);
  });
}
