import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getPlan, type PlanId, type Plan } from './plans';

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
  plan: Plan;
  planId: PlanId;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [planId, setPlanId] = useState<PlanId>('free');

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe —
    // using getSession() separately causes a double-init race condition.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        parseUserMetadata(currentUser);
      } else {
        setCompanyName('');
        setFirstName('');
        setLastName('');
        setTrialDaysLeft(null);
        setPlanId('free');
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

    // Plan — defaults to 'free' for all new accounts
    const rawPlan = (meta.plan as PlanId) ?? 'free';
    setPlanId(rawPlan === 'pro' ? 'pro' : 'free');

    // trialDaysLeft kept for display only, no enforcement (freemium replaces trial)
    setTrialDaysLeft(null);
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
      trialDaysLeft,
      plan: getPlan(planId),
      planId,
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
