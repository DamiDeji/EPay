import type { Metadata } from 'next';

import { Footer } from '@/components/landing/footer';
import { Navbar } from '@/components/landing/navbar';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for EPay — the decentralized payment gateway built on Stellar and Soroban.',
};

const LAST_UPDATED = 'August 19, 2026';

type TermSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const SECTIONS: TermSection[] = [
  {
    title: 'Introduction and Acceptance',
    paragraphs: [
      'These Terms of Service ("Terms") govern your access to and use of EPay, a decentralized payment gateway built on the Stellar network using Soroban smart contracts. "EPay" includes the customer web application, the merchant dashboard, the admin dashboard, the application programming interface (API), the software development kit (SDK), the deployed smart contracts, and any related tools, websites, documentation, and services (collectively, the "Services").',
      'By accessing or using the Services, you agree to be bound by these Terms. If you do not agree to these Terms, you must not access or use the Services. If you are using the Services on behalf of an organization, you represent that you have authority to bind that organization to these Terms.',
      'We may update these Terms from time to time. Updated Terms become effective when posted. Your continued use of the Services after any changes constitutes your acceptance of the updated Terms.',
    ],
  },
  {
    title: 'Definitions',
    bullets: [
      '"User", "you" or "your" means any person or entity that accesses or uses the Services.',
      '"Merchant" means a User who uses the Services to accept payments, create invoices, or otherwise receive funds.',
      '"Payer" or "Customer" means a person or entity that pays a Merchant through the Services.',
      '"Wallet" means a Stellar wallet (for example Freighter, xBull, Albedo, Rabet, or Lobstr) that you control.',
      '"Smart Contracts" means the Soroban-based contracts deployed by EPay, including payment, invoice, escrow, refund, subscription, and settlement contracts.',
      '"Stellar Network" means the public Stellar blockchain and its associated decentralized infrastructure, which EPay does not control.',
    ],
  },
  {
    title: 'The Services',
    paragraphs: [
      'EPay provides decentralized payment infrastructure, including payment routing and processing, invoicing, multi-milestone escrow, subscription billing, refunds, payment links and QR codes, merchant settlement, analytics, webhooks, and API access.',
      'The Services facilitate transactions that settle on the Stellar Network. EPay is non-custodial and does not hold, custody, or control your funds. Your use of any third-party services, including wallets and blockchain networks, is governed by the terms of those third parties.',
    ],
  },
  {
    title: 'Eligibility',
    paragraphs: [
      'You represent and warrant that (a) you are at least 18 years old or the age of majority in your jurisdiction of residence, (b) you have the full right, power, and authority to enter into these Terms, and (c) your use of the Services does not violate any law, regulation, or sanction applicable to you.',
      'You may not use the Services if you are located in, or a citizen or resident of, any jurisdiction that is subject to comprehensive sanctions or embargoes imposed by the United Nations, Switzerland, the European Union, the United States, or any other relevant authority, or if you are listed on any applicable sanctions or denied-party list.',
      'You are solely responsible for determining whether your use of the Services is lawful in your jurisdiction.',
    ],
  },
  {
    title: 'Accounts and Security',
    paragraphs: [
      'You may need to register an account to access certain features of the Services. You must provide accurate, current, and complete information and keep that information up to date.',
      'You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. You must notify us promptly of any unauthorized use of your account or any other breach of security.',
      'Each User may hold and use one account. You may not share, transfer, sell, or otherwise allow another person to use your account.',
    ],
  },
  {
    title: 'Wallets and Non-Custodial Nature',
    paragraphs: [
      'EPay is non-custodial. You connect your own Wallet to the Services and retain control of your private keys. EPay never takes custody of your funds, and no EPay party has access to or control over your private keys.',
      'You are solely responsible for the security of your Wallet, private keys, and seed phrases. If you lose access to your Wallet, private keys, or seed phrase, any funds associated with that Wallet may be permanently unrecoverable. EPay has no ability to recover, refund, or replace lost or stolen funds.',
      'EPay is not responsible for the acts or omissions of any third-party wallet provider or for failures or interruptions of the Stellar Network.',
    ],
  },
  {
    title: 'Fees and Settlement',
    paragraphs: [
      'Use of the Services may be subject to fees as displayed in the application or documentation. Blockchain network fees (such as Stellar transaction fees and Soroban resource fees) are your responsibility and are not controlled by EPay.',
      'Fees may be updated from time to time. We will provide notice of material fee changes where required by applicable law. By continuing to use the Services after a fee change, you agree to the updated fees.',
      'Settlement of funds to your Wallet is subject to finality on the Stellar Network. EPay does not guarantee settlement times and is not responsible for delays, failures, or errors on the Stellar Network.',
    ],
  },
  {
    title: 'Prohibited Activities',
    paragraphs: [
      'You agree not to engage in, or encourage or enable others to engage in, any of the following prohibited activities:',
      'If we determine, in our sole discretion, that you have engaged in any prohibited activity, we may take any action we deem appropriate, including suspending or terminating your access to the Services.',
    ],
    bullets: [
      'Using the Services for any unlawful activity, including money laundering, terrorist financing, fraud, or the sale of illegal goods or services;',
      'Violating any applicable sanctions, embargoes, or export-control laws;',
      'Attempting to defraud, phish, scam, or mislead EPay, other Users, or any third party;',
      'Interfering with, circumventing, or compromising the security, availability, or integrity of the Services, the smart contracts, or the Stellar Network;',
      'Introducing or attempting to introduce malware, viruses, backdoors, or other harmful code;',
      'Attempting to exploit, manipulate, or otherwise abuse the smart contracts or the Services;',
      'Creating or using multiple accounts, identities, or wallets to abuse the Services or to evade a suspension, ban, or other restriction;',
      'Infringing, or contributing to the infringement of, the intellectual property or other rights of any third party;',
      'Interfering with the access of any other user, host, or network, including by sending viruses, overloading, flooding, or spamming;',
      'Attempting to circumvent geographic restrictions imposed by the Services.',
    ],
  },
  {
    title: 'Intellectual Property',
    paragraphs: [
      'EPay retains all rights, title, and interest in and to the Services, including its software, branding, and related materials, subject to any applicable open-source licenses.',
      'Your use of the Services does not grant you any license or right except as expressly stated in these Terms. Open-source components of the Services remain governed by their respective licenses.',
      'By submitting, posting, or otherwise making content available through the Services, you grant EPay a non-exclusive, worldwide, royalty-free license to use, reproduce, and display that content solely to the extent necessary to provide the Services.',
    ],
  },
  {
    title: 'Privacy',
    paragraphs: [
      'Your use of the Services is subject to our Privacy Policy. Because the Stellar Network is a public blockchain, certain transaction information — including wallet addresses, amounts, and timestamps — is publicly visible and is not confidential.',
      'You should not submit any sensitive personal information on-chain or through channels that are publicly visible.',
    ],
  },
  {
    title: 'Disclaimer of Warranties',
    paragraphs: [
      'The Services are provided on an "as is" and "as available" basis, without warranties of any kind, whether express, implied, statutory, or otherwise. To the maximum extent permitted by law, EPay disclaims all warranties, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.',
      'EPay does not warrant that the Services will be uninterrupted, error-free, secure, or free of bugs or vulnerabilities. The Services rely on decentralized infrastructure, including the Stellar Network and Soroban smart contracts, over which EPay has limited or no control.',
    ],
  },
  {
    title: 'Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by applicable law, EPay and its contributors, developers, and service providers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, or funds, arising out of or in connection with your use of the Services, including (a) failures or malfunctions of any blockchain or network, (b) bugs or vulnerabilities in any smart contract, (c) hacks, exploits, or malicious attacks, and (d) any third-party services, products, or infrastructure, including wallets.',
      "Except in cases of gross negligence, fraud, or willful misconduct, EPay's aggregate liability to you under these Terms shall not exceed the amount of fees you paid to EPay during the twelve (12) months preceding the event giving rise to the claim, to the extent such a limitation is permitted by law.",
    ],
  },
  {
    title: 'Indemnification',
    paragraphs: [
      "To the fullest extent permitted by applicable law, you agree to indemnify, defend, and hold harmless EPay and its contributors, developers, officers, directors, employees, contractors, and service providers from and against all claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to (a) your breach of these Terms, (b) your use of the Services, (c) your violation of any law or the rights of any third party, or (d) your handling of any Wallet, private keys, or funds.",
    ],
  },
  {
    title: 'Termination and Suspension',
    paragraphs: [
      'We may suspend or terminate your access to the Services at any time, with or without notice, including if we determine that you have violated these Terms or applicable law.',
      'You may stop using the Services at any time. Termination of your account does not affect transactions that have already settled on the Stellar Network, which cannot be reversed.',
      'Sections that by their nature should survive termination, including those relating to liability, indemnification, intellectual property, and governing law, will survive termination of these Terms.',
    ],
  },
  {
    title: 'Taxes',
    paragraphs: [
      'You are solely responsible for determining and satisfying all tax obligations — including income, sales, use, value-added, or other taxes — arising from your use of the Services, including payments you receive. EPay is not responsible for determining your tax obligations and provides no tax advice.',
      'You agree to comply with all applicable tax laws and to indemnify and hold EPay harmless against any liabilities arising from your failure to do so.',
    ],
  },
  {
    title: 'Changes to the Services and These Terms',
    paragraphs: [
      'We may modify, suspend, or discontinue any part of the Services at any time, with or without notice. We may also update these Terms from time to time. Material changes will be communicated by posting the updated Terms, and the "Last updated" date will be revised accordingly.',
      'Your continued use of the Services after the updated Terms are posted constitutes your acceptance of the changes.',
    ],
  },
  {
    title: 'Governing Law and Jurisdiction',
    paragraphs: [
      'These Terms and any dispute, controversy, or claim arising out of or relating to them, whether in contract, tort, or otherwise, shall be governed by the laws of Switzerland, excluding its conflict-of-laws principles.',
      'Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the ordinary courts of Zug, Switzerland.',
    ],
  },
  {
    title: 'Severability',
    paragraphs: [
      'If any provision of these Terms is found to be invalid, illegal, or unenforceable, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.',
    ],
  },
  {
    title: 'Contact Us',
    paragraphs: [
      'If you have any questions about these Terms, please contact us through the channels listed on the EPay website or in the documentation.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-28 sm:pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          {/* Table of contents */}
          <nav
            aria-label="Table of contents"
            className="mb-12 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60"
          >
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Contents</h2>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {SECTIONS.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#section-${index + 1}`}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-[#0098EA] dark:hover:text-[#0098EA] transition-colors"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-12">
            {SECTIONS.map((section, index) => (
              <section key={section.title} id={`section-${index + 1}`} className="scroll-mt-28">
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-4">
                  {index + 1}. {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-4"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc pl-6 space-y-2 mb-4">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <p className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            These Terms are provided for informational purposes only and do not constitute legal
            advice. Please review them with qualified legal counsel before relying on them.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
