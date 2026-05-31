import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            company_name: company || 'FinTrust Member Entity',
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      // Check if user is created and if session is active or confirmation is pending
      if (data?.session) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('authMethod', 'email');
        localStorage.setItem('companyName', company || 'FinTrust Member Entity');
        navigate('/dashboard');
      } else {
        setSuccessMsg('Registration successful! Please check your inbox for an email verification link.');
        // Reset inputs on success message
        setFirstName('');
        setLastName('');
        setCompany('');
        setEmail('');
        setPassword('');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err?.message === 'Failed to fetch') {
        setError('Connection failed. Please ensure your Supabase URL (VITE_SUPABASE_URL) and Anon Key (VITE_SUPABASE_ANON_KEY) are configured in the Secrets panel.');
      } else {
        setError(err?.message || 'Could not complete registration. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (successMsg) {
    return (
      <AuthLayout 
        title="Verify your email" 
        subtitle="Confirm registration to activate your merchant account"
      >
        <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Check your email</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-[280px]">
            {successMsg}
          </p>
          <Link to="/login" className="w-full">
            <Button className="w-full">
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Start your 7-day free trial" 
      subtitle={
        <React.Fragment>
          Already have an account? <Link to="/login" className="font-medium text-primary hover:text-primary/80">Sign in</Link>
        </React.Fragment>
      }
    >
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              First name
            </Label>
            <Input 
              id="firstName" 
              name="firstName" 
              type="text" 
              required 
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="dark:bg-slate-950 dark:border-slate-800"
            />
          </div>
          <div>
            <Label htmlFor="lastName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Last name
            </Label>
            <Input 
              id="lastName" 
              name="lastName" 
              type="text" 
              required 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="dark:bg-slate-950 dark:border-slate-800"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="company" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Company name
          </Label>
          <Input 
            id="company" 
            name="company" 
            type="text" 
            placeholder="Acme Inc."
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="dark:bg-slate-950 dark:border-slate-800"
          />
        </div>

        <div>
          <Label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Work email
          </Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            autoComplete="email" 
            required 
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="dark:bg-slate-950 dark:border-slate-800"
          />
        </div>

        <div>
          <Label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Password
          </Label>
          <Input 
            id="password" 
            name="password" 
            type="password" 
            autoComplete="new-password" 
            required 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="dark:bg-slate-950 dark:border-slate-800"
          />
        </div>

        <div className="flex items-center">
          <input
            id="agree-terms"
            name="agree-terms"
            type="checkbox"
            required
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:checked:bg-primary"
          />
          <label htmlFor="agree-terms" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">
            I agree to the{' '}
            <a href="#" className="font-medium text-primary hover:text-primary/80">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="font-medium text-primary hover:text-primary/80">
              Privacy Policy
            </a>
          </label>
        </div>

        <div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full flex justify-center"
          >
            {isLoading ? "Starting trial..." : "Start 7-day free trial"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
