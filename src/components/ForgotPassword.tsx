import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MailCheck, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/settings',
      });

      if (resetError) {
        throw resetError;
      }

      setIsSent(true);
    } catch (err: any) {
      console.error('Password reset helper error:', err);
      setError(err?.message || 'Could not send recovery link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <AuthLayout 
        title="Check your email" 
        subtitle="We've sent a password reset link to your email."
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-6 text-center"
        >
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
            <MailCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Reset link sent!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-[250px]">
            Please check your inbox ({email}) and follow the instructions to reset your password.
          </p>
          <Link to="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Reset your password" 
      subtitle={
        <React.Fragment>
          Remember your password? <Link to="/login" className="font-medium text-primary hover:text-primary/80">Sign in</Link>
        </React.Fragment>
      }
    >
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
            className="dark:bg-slate-950 dark:border-slate-800"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            We will send you an email with a link to reset your password.
          </p>
        </div>

        <div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full flex justify-center"
          >
            {isLoading ? "Sending link..." : "Send reset link"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
