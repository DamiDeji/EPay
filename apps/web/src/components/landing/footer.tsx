import { Zap } from 'lucide-react';
import Link from 'next/link';

const FOOTER_LINKS = {
  Product: ['Features', 'Pricing', 'Documentation', 'API Reference', 'Changelog'],
  Resources: ['Blog', 'Guides', 'Help Center', 'Community', 'Status'],
  Company: ['About', 'Careers', 'Contact', 'Partners', 'Press'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security'],
} as const;

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0098EA] to-[#1E3A8A] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">
                <span className="text-[#0098EA]">E</span>Pay
              </span>
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Decentralized payment infrastructure on The Open Network.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              &copy; {new Date().getFullYear()} EPay. All rights reserved.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-3">
                {title}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-[#0098EA] dark:hover:text-[#0098EA] transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Built on{' '}
            <a
              href="https://ton.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0098EA] hover:underline"
            >
              The Open Network
            </a>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Apache-2.0 License
          </p>
        </div>
      </div>
    </footer>
  );
}
