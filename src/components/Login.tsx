import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (data?.session) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('authMethod', 'email');
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err?.message === 'Failed to fetch') {
        setError('Connection failed. Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file and the dev server is running.');
      } else {
        setError(err?.message || 'Invalid email or password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setError('');
    if (provider === 'github') setIsGithubLoading(true);
    else setIsGoogleLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + '/dashboard' },
      });
      if (authError) throw authError;
    } catch (err: any) {
      console.error(`${provider} auth error:`, err);
      setError(err?.message || `Could not connect with ${provider}. Please try again.`);
      setIsGithubLoading(false);
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Sign in to your account" 
      subtitle={
        <React.Fragment>
          Or <Link to="/register" className="font-medium text-primary hover:text-primary/80">start your 7-day free trial</Link>
        </React.Fragment>
      }
    >
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-red-700">{error}</div>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            Email address
          </Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            autoComplete="email" 
            required 
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white border-slate-200"
          />
        </div>

        <div>
          <Label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </Label>
          <Input 
            id="password" 
            name="password" 
            type="password" 
            autoComplete="current-password" 
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white border-slate-200"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <Link to="/forgot-password" className="font-medium text-primary hover:text-primary/80">
              Forgot your password?
            </Link>
          </div>
        </div>

        <div>
          <Button
            type="submit"
            disabled={isLoading || isGithubLoading || isGoogleLoading}
            className="w-full flex justify-center"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-slate-500">Or continue with</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" type="button" onClick={() => handleOAuthLogin('google')} disabled={isGoogleLoading || isLoading || isGithubLoading} className="w-full bg-white text-slate-700">
            <svg className="mr-2 h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
                fill="#EA4335"
              />
              <path
                d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                fill="#4285F4"
              />
              <path
                d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                fill="#FBBC05"
              />
              <path
                d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24 12.0004 24Z"
                fill="#34A853"
              />
            </svg>
            {isGoogleLoading ? "Connecting..." : "Google"}
          </Button>

          <Button
            variant="outline"
            type="button"
            onClick={() => handleOAuthLogin('github')}
            disabled={isGithubLoading || isLoading || isGoogleLoading}
            className="w-full bg-white text-slate-700"
          >
            <Github className="mr-2 h-4 w-4" />
            {isGithubLoading ? "Connecting..." : "GitHub"}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}

