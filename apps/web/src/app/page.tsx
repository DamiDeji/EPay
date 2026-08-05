'use client';

import { Button, Badge } from '@epay/ui';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  Wallet,
  ShieldCheck,
  Zap,
  BarChart3,
  Link as LinkIcon,
  RefreshCw,
  Globe,
  Lock,
  Users,
  Smartphone,
} from 'lucide-react';
import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const FEATURES = [
  {
    icon: Wallet,
    title: 'Accept Crypto Payments',
    description: 'Receive TON and other TON-based tokens. Instant settlement, no chargebacks.',
    color: 'from-blue-500/20 to-blue-600/10',
    iconColor: 'text-blue-500',
  },
  {
    icon: ShieldCheck,
    title: 'Escrow & Milestones',
    description: 'Protected transactions with milestone-based release and dispute resolution.',
    color: 'from-emerald-500/20 to-emerald-600/10',
    iconColor: 'text-emerald-500',
  },
  {
    icon: RefreshCw,
    title: 'Subscription Billing',
    description: 'Recurring payments with flexible intervals, trial periods, and auto-renewal.',
    color: 'from-purple-500/20 to-purple-600/10',
    iconColor: 'text-purple-500',
  },
  {
    icon: LinkIcon,
    title: 'Payment Links',
    description: 'Generate shareable payment links and QR codes — no website needed.',
    color: 'from-amber-500/20 to-amber-600/10',
    iconColor: 'text-amber-500',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Real-time revenue analytics, payment tracking, and business intelligence.',
    color: 'from-rose-500/20 to-rose-600/10',
    iconColor: 'text-rose-500',
  },
  {
    icon: Globe,
    title: 'Webhooks & API',
    description: 'RESTful API with webhook events. Integrate EPay into any stack in minutes.',
    color: 'from-cyan-500/20 to-cyan-600/10',
    iconColor: 'text-cyan-500',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Connect Wallet',
    description: 'Link your TON wallet in one click. No KYC required for basic usage.',
    icon: Wallet,
  },
  {
    step: '02',
    title: 'Create Merchant Account',
    description: 'Set up your business profile, settlement address, and webhook URL.',
    icon: Users,
  },
  {
    step: '03',
    title: 'Start Accepting',
    description: 'Create payment links, invoices, or integrate the API into your app.',
    icon: Globe,
  },
  {
    step: '04',
    title: 'Get Settled',
    description: 'Funds settle directly to your TON wallet — no middlemen, no delays.',
    icon: Zap,
  },
];

const TRUST_SIGNALS = [
  { icon: Lock, label: 'Non-Custodial' },
  { icon: ShieldCheck, label: 'Audited Contracts' },
  { icon: Zap, label: 'TON Native' },
  { icon: Smartphone, label: 'Mobile Ready' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative hero-glow pt-32 pb-20 sm:pt-40 sm:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0098EA]/5 via-transparent to-transparent" />

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#0098EA]/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="primary" className="mb-6 px-4 py-1.5 text-sm">
              Built on The Open Network
            </Badge>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.1]"
          >
            Decentralized Payments,{' '}
            <span className="gradient-text">Effortless</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            Enterprise-grade payment gateway on TON. Accept crypto, manage invoices, automate
            subscriptions, and settle instantly — all without intermediaries.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/register">
              <Button size="xl" className="gap-2 shadow-lg shadow-[#0098EA]/25 hover:shadow-xl hover:shadow-[#0098EA]/30 transition-all">
                <Wallet className="w-5 h-5" />
                Start Accepting Payments
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="https://docs.epay.dev" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="xl">
                Read the Docs
              </Button>
            </Link>
          </motion.div>

          {/* Trust Signals */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8"
          >
            {TRUST_SIGNALS.map((signal) => (
              <div key={signal.label} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <signal.icon className="w-4 h-4" />
                <span>{signal.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden">
              {/* Mock browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <div className="ml-3 flex-1 h-5 bg-slate-200 dark:bg-slate-700 rounded-full max-w-sm" />
              </div>
              {/* Mock Dashboard Content */}
              <div className="p-6 grid grid-cols-4 gap-4">
                <div className="col-span-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {['1,234 TON', '$2,891', '156', '98.5%'].map((val, i) => (
                    <div key={i} className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                      <div className="text-xs text-slate-400 mb-1">
                        {['Volume', 'Revenue', 'Transactions', 'Success Rate'][i]}
                      </div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white">{val}</div>
                    </div>
                  ))}
                </div>
                <div className="col-span-3 h-48 rounded-xl bg-slate-50 dark:bg-slate-700/50" />
                <div className="h-48 rounded-xl bg-slate-50 dark:bg-slate-700/50" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="default" className="mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Everything you need to accept payments
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              From simple payment links to complex escrow workflows — EPay handles it all with
              enterprise-grade security and reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group relative p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#0098EA]/30 dark:hover:border-[#0098EA]/30 hover:shadow-lg hover:shadow-[#0098EA]/5 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 sm:py-32 feature-gradient border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="success" className="mb-4">Simple</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Start in under 5 minutes
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              No complicated setup. Connect your wallet, create a merchant account, and start
              accepting payments immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <item.icon className="w-6 h-6 text-[#0098EA]" />
                </div>
                <div className="text-xs font-bold text-[#0098EA] mb-2">STEP {item.step}</div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl bg-gradient-to-br from-[#1E3A8A] via-[#0098EA] to-[#10B981] p-8 sm:p-16 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDI0djM2SDI0VjI0aDEyek0wIDI0aDEydjEySDBWMjR6TTQ4IDI0aDEydjEyaC0xMlYyNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to accept crypto payments?
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                Join thousands of merchants already using EPay. Free to start, pay only when you earn.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="xl" className="bg-white text-[#1E3A8A] hover:bg-white/90 shadow-lg">
                    <Wallet className="w-5 h-5 mr-2" />
                    Get Started Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="https://docs.epay.dev" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="xl"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 bg-transparent"
                  >
                    View Documentation
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/60">
                No credit card required &middot; 0.5% fee &middot; Instant settlement
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
