import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, authAPI } from '@/app/lib/api';

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const result = await authAPI.signUp(email, password, name);

    // Create profile if user is authenticated (email confirmation might not be required)
    if (result.user && result.session) {
      try {
        await supabase.from('profiles').insert({
          id: result.user.id,
          full_name: name,
          email: result.user.email,
          is_verified: !!result.user.email_confirmed_at
        });
      } catch (profileError) {
        console.warn('Profile creation failed:', profileError);
        // Don't throw here - profile can be created later when user logs in
      }
    }

    return result;
  };

  const signIn = async (email: string, password: string) => {
    const result = await authAPI.login(email, password);

    // Update last login and ensure profile exists
    if (result.user) {
      try {
        // First try to update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('id', result.user.id);

        // If no profile exists, create one
        if (updateError && updateError.code === 'PGRST116') {
          await supabase.from('profiles').insert({
            id: result.user.id,
            email: result.user.email,
            full_name: result.user.user_metadata?.full_name || '',
            is_verified: !!result.user.email_confirmed_at,
            last_login: new Date().toISOString()
          });
        }
      } catch (profileError) {
        console.warn('Profile update failed:', profileError);
      }
    }

    return result;
  };

  const signOut = async () => {
    await authAPI.logout();
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