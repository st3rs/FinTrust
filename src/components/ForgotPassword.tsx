import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MailCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API request
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 1000);
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
            Please check your inbox and follow the instructions to reset your password.
          </p>
          <Link to="/login">
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
