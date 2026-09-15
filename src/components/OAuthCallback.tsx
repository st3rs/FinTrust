import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

const OAUTH_PROVIDER_KEY = 'fintrust.oauth.provider';
const OAUTH_STARTED_AT_KEY = 'fintrust.oauth.started_at';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { user, loading, updateMetadata } = useAuth();
  const [error, setError] = useState('');
  const handledRef = useRef(false);

  useEffect(() => {
    if (loading || handledRef.current) return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const oauthError = hashParams.get('error_description') || queryParams.get('error_description');

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!user) {
      setError('We could not establish your session. Please sign in again.');
      return;
    }

    handledRef.current = true;

    const finishOAuth = async () => {
      const provider = sessionStorage.getItem(OAUTH_PROVIDER_KEY);
      const startedAt = Number(sessionStorage.getItem(OAUTH_STARTED_AT_KEY) || 0);
      const createdAt = Date.parse(user.created_at || '');
      const lastSignInAt = Date.parse(user.last_sign_in_at || '');

      sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
      sessionStorage.removeItem(OAUTH_STARTED_AT_KEY);

      const isSupportedOAuthProvider = provider === 'google' || provider === 'github';
      const wasCreatedDuringThisAttempt =
        startedAt > 0 &&
        Number.isFinite(createdAt) &&
        createdAt >= startedAt - 60_000 &&
        createdAt <= Date.now() + 60_000;
      const looksLikeFirstSession =
        Number.isFinite(createdAt) &&
        Number.isFinite(lastSignInAt) &&
        Math.abs(lastSignInAt - createdAt) <= 120_000;
      const alreadyCompleted = user.user_metadata?.onboarding_completed === true;
      const isNewOAuthUser =
        isSupportedOAuthProvider &&
        !alreadyCompleted &&
        (wasCreatedDuringThisAttempt || looksLikeFirstSession);

      if (isNewOAuthUser) {
        try {
          await updateMetadata({
            onboarding_required: true,
            onboarding_completed: false,
            oauth_provider: provider,
          });
          navigate('/onboarding', { replace: true });
          return;
        } catch (err: any) {
          console.error('Failed to mark OAuth onboarding requirement:', err);
          setError('Your account was created, but setup could not be completed safely. Please try signing in again.');
          return;
        }
      }

      navigate('/dashboard', { replace: true });
    };

    void finishOAuth();
  }, [loading, user, updateMetadata, navigate]);

  return (
    <AuthLayout
      title={error ? 'Sign-in could not be completed' : 'Finishing sign-in'}
      subtitle={error ? 'Your account has not been opened yet.' : 'Securing your session and preparing your workspace.'}
    >
      {error ? (
        <div className="space-y-5">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
          <Link
            to="/login"
            className="block w-full rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-slate-600">Please keep this tab open for a moment.</p>
        </div>
      )}
    </AuthLayout>
  );
}
