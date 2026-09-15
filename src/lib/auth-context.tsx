import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getPlan, type PlanId, type Plan } from './plans';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companyName: string;
  setCompanyNameState: (name: string) => void;
  updateMetadata: (data: Record<string, unknown>) => Promise<void>;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  needsOnboarding: boolean;
  signOut: () => Promise<void>;
  trialDaysLeft: number | null;
  plan: Plan;
  planId: PlanId;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getNameParts = (metadata: Record<string, any>) => {
  const fullName = String(metadata.full_name || metadata.name || '').trim();
  const fullNameParts = fullName ? fullName.split(/\s+/) : [];

  const firstName = String(
    metadata.first_name ||
      metadata.firstName ||
      metadata.given_name ||
      fullNameParts[0] ||
      ''
  ).trim();

  const lastName = String(
    metadata.last_name ||
      metadata.lastName ||
      metadata.family_name ||
      (fullNameParts.length > 1 ? fullNameParts.slice(1).join(' ') : '') ||
      ''
  ).trim();

  return { firstName, lastName };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [planId, setPlanId] = useState<PlanId>('free');

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe.
    // Using getSession() separately here causes a double-init race condition.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      const currentUser = nextSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        parseUserMetadata(currentUser);
      } else {
        setCompanyName('');
        setFirstName('');
        setLastName('');
        setAvatarUrl('');
        setNeedsOnboarding(false);
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
    const meta = (currentUser.user_metadata || {}) as Record<string, any>;
    const metaCompany = String(meta.company_name || meta.company || '').trim();
    const names = getNameParts(meta);
    const metaAvatar = String(meta.avatar_url || meta.picture || '').trim();
    const companyStorageKey = `companyName:${currentUser.id}`;

    if (metaCompany) {
      setCompanyName(metaCompany);
      localStorage.setItem(companyStorageKey, metaCompany);
    } else {
      // Never use a global companyName fallback: it can leak the previous
      // account's company name when multiple people use the same browser.
      setCompanyName(localStorage.getItem(companyStorageKey) || '');
    }

    setFirstName(names.firstName);
    setLastName(names.lastName);
    setAvatarUrl(metaAvatar);
    setNeedsOnboarding(meta.onboarding_required === true && meta.onboarding_completed !== true);

    // Plan defaults to free. Paid authorization must only use server-owned
    // app_metadata because user_metadata is editable by the signed-in user.
    const rawPlan = (currentUser.app_metadata?.plan as PlanId) ?? 'free';
    setPlanId(rawPlan === 'pro' ? 'pro' : 'free');

    // Kept for display compatibility only. Freemium replaces trial enforcement.
    setTrialDaysLeft(null);
  };

  const setCompanyNameState = (name: string) => {
    const normalized = name.trim();
    setCompanyName(normalized);

    if (user) {
      localStorage.setItem(`companyName:${user.id}`, normalized);
      supabase.auth.updateUser({
        data: { company_name: normalized },
      }).catch((err) => console.error('Failed to update user company metadata:', err));
    }
  };

  const updateMetadata = async (data: Record<string, unknown>) => {
    if (!user) return;

    const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({
      data,
    });

    if (error) throw error;

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
      localStorage.removeItem('companyName'); // remove legacy cross-account key
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setUser(null);
      setSession(null);
      setCompanyName('');
      setFirstName('');
      setLastName('');
      setAvatarUrl('');
      setNeedsOnboarding(false);
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
      avatarUrl,
      needsOnboarding,
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
