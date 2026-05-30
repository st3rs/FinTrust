import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Register() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate registration
    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authMethod', 'email');
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 7);
      localStorage.setItem('trialEndsAt', trialEnds.toISOString());
      navigate('/dashboard');
    }, 1000);
  };

  return (
    <AuthLayout 
      title="Start your 7-day free trial" 
      subtitle={
        <React.Fragment>
          Already have an account? <Link to="/login" className="font-medium text-primary hover:text-primary/80">Sign in</Link>
        </React.Fragment>
      }
    >
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
