/**
 * Offline stub — ranked/cloud features are optional. Combat never depends on this.
 */
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

export function createClient(): any {
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
