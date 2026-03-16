import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT } from '../lib/api';
import { AuthSessionResponse, AuthUser, Profile } from '../lib/types';

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    async function loadCurrentUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const session = await api.get<AuthSessionResponse>('/auth/me');
        setUser(session.user);
        setProfile(session.profile);
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    function handleUnauthorized() {
      setUser(null);
      setProfile(null);
      setLoading(false);
    }

    void loadCurrentUser();
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const session = await api.post<AuthSessionResponse>('/auth/login', { email, password });
    if (!session.token) {
      throw new Error('Authentication token missing from server response.');
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    setUser(session.user);
    setProfile(session.profile);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const session = await api.post<AuthSessionResponse>('/auth/signup', {
      email,
      password,
      fullName,
    });

    if (session.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    }

    setUser(session.user);
    setProfile(session.profile);
  };

  const signOut = async () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
