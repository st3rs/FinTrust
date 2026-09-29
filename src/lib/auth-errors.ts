/**
 * Shared classification for Supabase auth failures.
 *
 * Why this exists: Login.tsx and Register.tsx both treated *any* `Failed to fetch`
 * as "your .env is misconfigured". That is only one of several causes — a paused
 * Supabase project (its DNS record is withdrawn), an offline client, or a blocked
 * request all surface the identical message. On the deployed site that advice is
 * both wrong and useless to an end user.
 *
 * Rule of thumb: `userMessage` is rendered in the UI (production included), so it
 * must never mention env vars, file paths, or internal hosts. `devHint` is for the
 * console only.
 */

export type AuthErrorKind = 'network' | 'credentials' | 'rate-limit' | 'unknown';

export interface AuthErrorInfo {
  /** What actually went wrong. */
  kind: AuthErrorKind;
  /** Safe to render to any user, in any environment. */
  userMessage: string;
  /** Console-only detail for developers. Never rendered. */
  devHint?: string;
}

/** The fallback host used by src/lib/supabase.ts when config is missing. */
const PLACEHOLDER_HOST = 'placeholder-project.supabase.co';

/**
 * True when the app booted without real Supabase config and is pointing at the
 * placeholder fallback. Distinguishes "developer hasn't set up .env" from
 * "correctly configured but the backend is unreachable".
 */
export function isPlaceholderConfig(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return !url?.startsWith('http') || url.includes(PLACEHOLDER_HOST) || !key;
}

/**
 * True for transport-level failures where no HTTP response was received.
 * Browsers disagree on the wording, hence the list.
 */
export function isNetworkError(err: unknown): boolean {
  const message = (err as { message?: string } | null)?.message ?? '';
  return (
    message === 'Failed to fetch' ||                                  // Chrome/Edge
    message === 'Load failed' ||                                      // Safari
    message === 'NetworkError when attempting to fetch resource.'     // Firefox
  );
}

/** True when the browser itself reports no connectivity. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Map a thrown Supabase auth error onto an AuthErrorInfo.
 *
 * Policy:
 * 1. Network failures: the ".env" hint is shown in the UI only in dev builds with
 *    placeholder config; everywhere else it goes to the console via `devHint`.
 * 2. Offline and backend-unreachable are split — the user's next step differs
 *    (fix their connection vs. wait and retry).
 * 3. Invalid credentials get a deliberately vague message (no account enumeration).
 *    Other 4xx messages from Supabase ("User already registered", weak password)
 *    are passed through because the user must act on them.
 * 4. Rate limits (HTTP 429 / over_*_rate_limit) get their own message.
 */
export function classifyAuthError(err: unknown): AuthErrorInfo {
  const e = (err ?? {}) as { message?: string; status?: number; code?: string };
  const message = e.message ?? '';

  if (isNetworkError(err)) {
    if (isOffline()) {
      return { kind: 'network', userMessage: 'You appear to be offline. Check your internet connection and try again.' };
    }
    if (isPlaceholderConfig()) {
      const devHint = 'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart the dev server.';
      return {
        kind: 'network',
        userMessage: import.meta.env.DEV ? devHint : 'Sign-in is temporarily unavailable. Please try again later.',
        devHint,
      };
    }
    return {
      kind: 'network',
      userMessage: "We're having trouble reaching our servers. Please try again in a moment.",
      devHint: 'Supabase host unreachable. If this is a free-tier project it may be paused — restore it in the Supabase dashboard.',
    };
  }

  if (e.status === 429 || /rate_limit/.test(e.code ?? '') || /rate limit/i.test(message)) {
    return { kind: 'rate-limit', userMessage: 'Too many attempts. Please wait a few minutes and try again.' };
  }

  if (e.code === 'invalid_credentials' || message === 'Invalid login credentials') {
    return { kind: 'credentials', userMessage: 'Email or password is incorrect.' };
  }

  if (message && e.status !== undefined && e.status >= 400 && e.status < 500) {
    return { kind: 'unknown', userMessage: message };
  }

  return { kind: 'unknown', userMessage: 'Something went wrong. Please try again.', devHint: message || undefined };
}

/** Log the dev hint (if any) and return the message to render. */
export function reportAuthError(context: string, err: unknown): string {
  const info = classifyAuthError(err);
  console.error(`${context}:`, err);
  if (info.devHint) console.warn(`[auth] ${info.devHint}`);
  return info.userMessage;
}
