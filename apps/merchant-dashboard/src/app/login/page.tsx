'use client';

import { Button, Input, Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@epay/ui';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MerchantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message ?? 'Invalid credentials');
      }
      const data = await response.json();
      localStorage.setItem('epay_access_token', data.tokens.accessToken);
      localStorage.setItem('epay_refresh_token', data.tokens.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E3A8A]/10 to-[#0098EA]/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-[#1E3A8A]" />
            </div>
            <CardTitle className="text-2xl">Merchant Login</CardTitle>
            <CardDescription>Sign in to your EPay merchant account</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="email" placeholder="merchant@business.com" value={email} onChange={(e) => { setEmail(e.target.value); }} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); }} className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" size="lg" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              New merchant?{' '}
              <a href="/register" className="text-[#0098EA] hover:underline font-medium">Create account</a>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
