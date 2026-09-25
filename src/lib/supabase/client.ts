/**
 * Real Supabase browser client when NEXT_PUBLIC_ / VITE_ credentials exist
 * (Brutal-Fist ranked, matchmaking, replays). Otherwise an offline stub so
 * combat and the live preview keep running with no cloud project.
 */
'use client';

import { createBrowserClient } from '@supabase/ssr';

const PFX = 'sb_';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

type AnyRec = Record<string, any>;

function thenable<T>(value: T) {
  return Promise.resolve(value);
}

function chain(result: { data: any; error: any; count?: number } = { data: [], error: null }): AnyRec {
  const api: AnyRec = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete", "eq", "neq", "gt", "lt",
    "gte", "lte", "in", "is", "order", "limit", "range", "maybeSingle", "single",
    "match", "filter", "or", "not", "ilike", "contains", "rpc",
  ];
  for (const m of methods) {
    api[m] = (..._args: unknown[]) => chain(result);
  }
  api.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    thenable(result).then(resolve, reject);
  return api;
}

function createOfflineClient(): any {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: "Cloud auth is offline in this build" } }),
      signUp: async () => ({ data: { user: null, session: null }, error: { message: "Cloud auth is offline in this build" } }),
      signOut: async () => ({ error: null }),
    },
    from: (..._args: unknown[]) => chain(),
    rpc: (..._args: unknown[]) => chain(),
    channel: (..._args: unknown[]) => {
      const ch: AnyRec = {};
      ch.on = (..._a: unknown[]) => ch;
      ch.subscribe = (..._a: unknown[]) => ({ status: "offline" });
      ch.unsubscribe = (..._a: unknown[]) => ch;
      return ch;
    },
    removeChannel() {},
  };
}

const canUseCookies = (() => {
  let cache: boolean | null = null;
  return () => {
    if (typeof document === 'undefined') return false;
    if (cache !== null) return cache;
    const k = '__sb_test__';
    document.cookie = `${k}=1; Path=/; SameSite=None; Secure; Partitioned`;
    cache = document.cookie.includes(k);
    document.cookie = `${k}=; Path=/; Max-Age=0; SameSite=None; Secure`;
    return cache;
  };
})();

const fromCookies = () =>
  typeof document === 'undefined' ? [] :
  document.cookie.split(';').filter(Boolean).map((c) => {
    const parts = c.trim().split('=');
    return { name: parts[0].trim(), value: decodeURIComponent(parts.slice(1).join('=')) };
  }).filter((c) => c.name);

const fromStorage = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PFX))
      .map((k) => ({ name: k.slice(PFX.length), value: localStorage.getItem(k) || '' }));
  } catch { return []; }
};

const setCookie = (name: string, value: string, options?: any) => {
  let s = `${name}=${encodeURIComponent(value)}; Path=${options?.path || '/'}; SameSite=None; Secure; Partitioned`;
  if (options?.maxAge) s += `; Max-Age=${options.maxAge}`;
  if (options?.domain) s += `; Domain=${options.domain}`;
  if (options?.expires) s += `; Expires=${new Date(options.expires).toUTCString()}`;
  document.cookie = s;
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const domains = ['', host, host ? `.${host}` : ''].filter(Boolean);
  const variants = [
    'Path=/; SameSite=Lax',
    'Path=/; SameSite=None; Secure',
    'Path=/; SameSite=None; Secure; Partitioned',
  ];
  variants.forEach((attrs) => {
    document.cookie = `${name}=; Max-Age=0; ${attrs}`;
    domains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; Domain=${domain}; ${attrs}`;
    });
  });
};

const getToken = () =>
  (canUseCookies() ? fromCookies() : fromStorage())
    .find((c) => c.name.includes('auth-token'))?.value ?? null;

if (typeof window !== 'undefined' && !(window as any).__sb_patched__) {
  (window as any).__sb_patched__ = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const token = getToken();
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;
    if (token && (url.startsWith('/') || url.startsWith(window.location.origin))) {
      init = { ...(init || {}), headers: { ...(init?.headers || {}), 'x-sb-token': token } };
    }
    return orig(input, init);
  };
}

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return createOfflineClient();
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll: () => canUseCookies() ? fromCookies() : fromStorage(),
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return;
          if (canUseCookies()) {
            cookiesToSet.forEach(({ name, value, options }) =>
              value ? setCookie(name, value, options) : deleteCookie(name)
            );
          } else {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                value ? localStorage.setItem(`${PFX}${name}`, value)
                      : localStorage.removeItem(`${PFX}${name}`);
              } catch { /* private mode */ }
              if (value) setCookie(name, value, options);
            });
          }
        },
      },
    }
  );
}
