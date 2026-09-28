/**
 * Rate limiting simple en memoria para el login.
 *
 * LÍMITE: máximo LOGIN_MAX_FAILURES (5) intentos fallidos por combinación
 * IP+email, y LOGIN_MAX_FAILURES_PER_IP (20) por IP, dentro de una ventana
 * deslizante de 15 minutos. Al superarlo se bloquea hasta que expire la
 * ventana (respuesta 429 con Retry-After). Un login correcto limpia el
 * contador de ese IP+email.
 *
 * Nota: en Vercel (serverless) la memoria es por instancia, así que el
 * límite es "best effort". Supabase Auth aplica además su propio rate limit
 * por IP en /auth/v1/token. Para un límite global usar Upstash/Redis.
 */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_MAX_FAILURES_PER_IP = 20;

type Bucket = { count: number; firstAt: number };

const globalStore = globalThis as unknown as { __loginRateLimit?: Map<string, Bucket> };
const store: Map<string, Bucket> = globalStore.__loginRateLimit ?? new Map();
globalStore.__loginRateLimit = store;

function prune(now: number) {
  if (store.size < 5000) return;
  store.forEach((b, k) => {
    if (now - b.firstAt > LOGIN_WINDOW_MS) store.delete(k);
  });
}

function get(key: string, now: number): Bucket | null {
  const b = store.get(key);
  if (!b) return null;
  if (now - b.firstAt > LOGIN_WINDOW_MS) {
    store.delete(key);
    return null;
  }
  return b;
}

function keys(ip: string, email: string) {
  return { pair: `pair:${ip}:${email.toLowerCase()}`, ip: `ip:${ip}` };
}

/** Devuelve segundos restantes de bloqueo, o 0 si puede intentar. */
export function checkLoginAllowed(ip: string, email: string, now = Date.now()): number {
  const k = keys(ip, email);
  const pair = get(k.pair, now);
  const byIp = get(k.ip, now);
  const blockedPair = pair && pair.count >= LOGIN_MAX_FAILURES;
  const blockedIp = byIp && byIp.count >= LOGIN_MAX_FAILURES_PER_IP;
  if (!blockedPair && !blockedIp) return 0;
  const until = Math.max(
    blockedPair ? pair!.firstAt + LOGIN_WINDOW_MS : 0,
    blockedIp ? byIp!.firstAt + LOGIN_WINDOW_MS : 0
  );
  return Math.max(1, Math.ceil((until - now) / 1000));
}

export function registerLoginFailure(ip: string, email: string, now = Date.now()) {
  prune(now);
  const k = keys(ip, email);
  for (const key of [k.pair, k.ip]) {
    const b = get(key, now);
    if (b) b.count += 1;
    else store.set(key, { count: 1, firstAt: now });
  }
}

export function registerLoginSuccess(ip: string, email: string) {
  store.delete(keys(ip, email).pair);
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
