import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companyName: string;
  setCompanyNameState: (name: string) => void;
  updateMetadata: (data: any) => Promise<void>;
  firstName: string;
  lastName: string;
  signOut: () => Promise<void>;
  trialDaysLeft: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('FinTrust Corp.');
  const [firstName, setFirstName] = useState('John');
  const [lastName, setLastName] = useState('Doe');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(7);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          parseUserMetadata(currentUser);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to fetch initial session:', err);
        setLoading(false);
      });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        parseUserMetadata(currentUser);
      } else {
        // Reset state on sign out
        setCompanyName('FinTrust Corp.');
        setFirstName('John');
        setLastName('Doe');
        setTrialDaysLeft(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const parseUserMetadata = (currentUser: User) => {
    const meta = currentUser.user_metadata || {};
    const metaCompany = meta.company_name || meta.company || '';
    const metaFirst = meta.first_name || meta.firstName || '';
    const metaLast = meta.last_name || meta.lastName || '';
    
    if (metaCompany) {
      setCompanyName(metaCompany);
      localStorage.setItem('companyName', metaCompany);
    } else {
      const stored = localStorage.getItem('companyName');
      if (stored) setCompanyName(stored);
    }

    if (metaFirst) setFirstName(metaFirst);
    if (metaLast) setLastName(metaLast);

    // Calculate trial days left
    const createdAt = new Date(currentUser.created_at);
    const now = new Date();
    const diff = createdAt.getTime() + 7 * 24 * 60 * 60 * 1000 - now.getTime();
    if (diff > 0) {
      setTrialDaysLeft(Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } else {
      setTrialDaysLeft(0);
    }
  };

  const setCompanyNameState = (name: string) => {
    setCompanyName(name);
    localStorage.setItem('companyName', name);
    
    // Attempt to update Supabase metadata of the current user asynchronously
    if (user) {
      supabase.auth.updateUser({
        data: { company_name: name }
      }).catch(err => console.error('Failed to update user company metadata:', err));
    }
  };

  const updateMetadata = async (data: any) => {
    if (!user) return;
    const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({
      data
    });
    if (error) {
      throw error;
    }
    if (updatedUser) {
      setUser(updatedUser);
      parseUserMetadata(updatedUser);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('authMethod');
      localStorage.removeItem('trialEndsAt');
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setUser(null);
      setSession(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      companyName,
      setCompanyNameState,
      updateMetadata,
      firstName,
      lastName,
      signOut,
      trialDaysLeft
    }}>
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
