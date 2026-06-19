import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authAPI } from '@/app/lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface Session {
  access_token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      const session = await authAPI.getSession();
      if (session) {
        setSession(session);
        setUser(session.user);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const result = await authAPI.signUp(email, password, name);
    setSession(result.session);
    setUser(result.user);
  };

  const signIn = async (email: string, password: string) => {
    const result = await authAPI.login(email, password);
    setSession(result.session);
    setUser(result.user);
  };

  const signOut = async () => {
    await authAPI.logout();
    setSession(null);
    setUser(null);
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}