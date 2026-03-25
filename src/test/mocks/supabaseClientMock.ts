export type MockQueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

/**
 * Chainable thenable that mimics Postgrest builders (select/eq/await → result).
 */
export function createQueryBuilder(result: MockQueryResult) {
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (onFulfilled: (value: MockQueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected);
        }
        if (prop === 'catch') {
          return Promise.resolve(result).catch.bind(Promise.resolve(result));
        }
        if (prop === 'finally') {
          return Promise.resolve(result).finally.bind(Promise.resolve(result));
        }
        return () => proxy;
      },
    }
  );
  return proxy;
}

export type SupabaseMockOptions = {
  tables: Record<string, MockQueryResult>;
  auth?: {
    getUser?: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    updateUser?: () => Promise<{ data: unknown; error: unknown }>;
  };
  storageUpload?: MockQueryResult;
  functionsInvoke?: MockQueryResult | (() => Promise<MockQueryResult>);
};

/** Plain mock (no Vitest); wrap `from` with vi.fn in test files if needed. */
export function createSupabaseMock(options: SupabaseMockOptions) {
  const getTableResult = (table: string) => options.tables[table] ?? { data: null, error: null };

  const defaultAuth = {
    signInWithPassword: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser:
      options.auth?.getUser ??
      (() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
    updateUser:
      options.auth?.updateUser ?? (() => Promise.resolve({ data: { user: null }, error: null })),
    resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
    refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: (_cb: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  };

  return {
    from(table: string) {
      return createQueryBuilder(getTableResult(table));
    },
    auth: defaultAuth,
    storage: {
      from() {
        return {
          upload: async () => options.storageUpload ?? { data: { path: 'mock' }, error: null },
          getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/avatar.png' } }),
        };
      },
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
    functions: {
      invoke: async () => {
        const r = options.functionsInvoke;
        if (typeof r === 'function') return r();
        return r ?? { data: null, error: null };
      },
    },
  };
}
