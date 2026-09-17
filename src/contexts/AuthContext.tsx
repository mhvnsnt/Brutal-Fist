import { createContext, useContext, useMemo, type ReactNode } from "react";

type GameUser = { id: string; email: string } | null;

interface AuthValue {
  user: GameUser;
  session: null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<unknown>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<unknown>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<GameUser>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo<AuthValue>(() => ({
    user: null,
    session: null,
    loading: false,
    signIn: async () => ({ error: { message: "Local preview — ranked cloud is optional" } }),
    signUp: async () => ({ error: { message: "Local preview — ranked cloud is optional" } }),
    signOut: async () => {},
    getCurrentUser: async () => null,
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
