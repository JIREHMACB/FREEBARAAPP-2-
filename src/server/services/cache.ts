const cache = new Map<string, { data: any; exp: number }>();

export const cacheGet = (key: string) => {
  const e = cache.get(key);
  if (!e || Date.now() > e.exp) { cache.delete(key); return null; }
  return e.data;
};

export const cacheSet = (key: string, data: any, ttlMs = 30000) =>
  cache.set(key, { data, exp: Date.now() + ttlMs });

export const cacheDel = (...patterns: string[]) => {
  for (const k of cache.keys())
    if (patterns.some(p => k.startsWith(p))) cache.delete(k);
};

export const cacheSize = () => cache.size;

// Nettoyage auto toutes les 2 minutes
setInterval(() => {
  const n = Date.now();
  for (const [k, v] of cache) if (n > v.exp) cache.delete(k);
}, 2 * 60000);