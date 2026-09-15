import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Building2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

const TERMS_VERSION = '2026-09-15';
const PRIVACY_VERSION = '2026-09-15';
const OAUTH_ONBOARDING_PENDING_KEY = 'fintrust.oauth.onboarding_pending';

export default function Onboarding() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    companyName,
    firstName,
    lastName,
    needsOnboarding,
    updateMetadata,
  } = useAuth();

  const [company, setCompany] = useState(companyName);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const onboardingCompleted = user?.user_metadata?.onboarding_completed === true;
  const pendingOAuthOnboarding = sessionStorage.getItem(OAUTH_ONBOARDING_PENDING_KEY) === '1';
  const shouldShowOnboarding = Boolean(user) && (needsOnboarding || pendingOAuthOnboarding) && !onboardingCompleted;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
      return;
    }

    if (!loading && user && onboardingCompleted) {
      sessionStorage.removeItem(OAUTH_ONBOARDING_PENDING_KEY);
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!loading && user && !needsOnboarding && !pendingOAuthOnboarding) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, onboardingCompleted, needsOnboarding, pendingOAuthOnboarding, navigate]);

  useEffect(() => {
    if (companyName && !company) setCompany(companyName);
  }, [companyName, company]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const normalizedCompany = company.trim();
    if (!normalizedCompany) {
      setError('Please enter your company or business name.');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError('Please accept both the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setIsSaving(true);

    try {
      const acceptedAt = new Date().toISOString();
      await updateMetadata({
        company_name: normalizedCompany,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        terms_accepted_at: acceptedAt,
        terms_version: TERMS_VERSION,
        privacy_accepted_at: acceptedAt,
        privacy_version: PRIVACY_VERSION,
        onboarding_required: false,
        onboarding_completed: true,
        onboarding_completed_at: acceptedAt,
      });

      sessionStorage.removeItem(OAUTH_ONBOARDING_PENDING_KEY);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Onboarding completion failed:', err);
      setError(err?.message || 'Could not save your account setup. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !shouldShowOnboarding) {
    return (
      <AuthLayout title="Preparing your account" subtitle="Checking your account setup.">
        <div className="py-8 text-center text-sm text-slate-600">Loading...</div>
      </AuthLayout>
    );
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || user?.email || 'there';

  return (
    <AuthLayout
      title="Complete your account"
      subtitle={`Welcome, ${displayName}. One final step before your dashboard.`}
    >
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-red-700">{error}</div>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Your sign-in is verified</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                We only need your business details and consent before opening the workspace.
              </p>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="company" className="mb-1 block text-sm font-medium text-slate-700">
            Company or business name
          </Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="company"
              name="company"
              type="text"
              required
              autoComplete="organization"
              placeholder="Your company name"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="bg-white pl-9 border-slate-200"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>I agree to the Terms of Service.</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>I acknowledge the Privacy Policy.</span>
          </label>
        </div>

        <Button
          type="submit"
          disabled={isSaving || !company.trim() || !termsAccepted || !privacyAccepted}
          className="w-full"
        >
          {isSaving ? 'Saving account setup...' : 'Continue to dashboard'}
        </Button>
      </form>
    </AuthLayout>
  );
}
