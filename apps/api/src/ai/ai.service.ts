import { Anthropic } from '@anthropic-ai/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

interface AiSummaryOptions {
  maxLength?: number;
  tone?: 'professional' | 'casual' | 'technical';
}

export interface MerchantSummary {
  overview: string;
  keyMetrics: string[];
  recentActivity: string;
  recommendations?: string[];
}

export interface InvoiceSummary {
  invoiceId: string;
  amount: string;
  statusDescription: string;
  dueDateStatus: string;
  paymentInstructions: string;
}

export interface SettlementSummary {
  settlementId: string;
  amount: string;
  netAmount: string;
  feeBreakdown: string;
  statusDescription: string;
  nextSteps: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly cache = new Map<string, { data: unknown; expiresAt: number }>();

  /**
   * Number of cached summaries. Exposed because the controller's health probe
   * reports it; reading the private map directly did not compile (`TS2341`).
   */
  get cacheSize(): number {
    return this.cache.size;
  }

  constructor(
    @Inject('AnthropicClient') private readonly anthropic: Anthropic,
    private readonly prisma: PrismaService,
  ) {}

  // ════════════════════════════════════════════════════════════════════
  // MERCHANT SUMMARIES
  // ════════════════════════════════════════════════════════════════════

  async generateMerchantSummary(
    merchantId: string,
    options: AiSummaryOptions = {},
  ): Promise<MerchantSummary> {
    const cacheKey = `merchant:${merchantId}:${options.tone ?? 'professional'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as MerchantSummary;
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        user: true,
        _count: {
          select: {
            payments: true,
            invoices: true,
            subscriptions: true,
            settlements: true,
          },
        },
      },
    });

    if (!merchant) {
      throw new Error(`Merchant ${merchantId} not found`);
    }

    const prompt = this.buildMerchantPrompt(merchant);
    const summary = await this.callAnthropic(prompt, options);

    const result: MerchantSummary = {
      overview: this.extractSection(summary, 'Overview'),
      keyMetrics: this.extractBulletList(summary, 'Key Metrics'),
      recentActivity: this.extractSection(summary, 'Recent Activity'),
      recommendations: this.extractBulletList(summary, 'Recommendations') || undefined,
    };

    // Cache for 1 hour
    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 3600_000 });
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  // INVOICE SUMMARIES
  // ════════════════════════════════════════════════════════════════════

  async generateInvoiceSummary(
    invoiceId: string,
    options: AiSummaryOptions = {},
  ): Promise<InvoiceSummary> {
    const cacheKey = `invoice:${invoiceId}:${options.tone ?? 'professional'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as InvoiceSummary;
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        merchant: { include: { user: true } },
        items: true,
        payment: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const prompt = this.buildInvoicePrompt(invoice);
    const summary = await this.callAnthropic(prompt, options);

    const result: InvoiceSummary = {
      invoiceId: invoice.invoiceNumber,
      amount: this.formatAmount(invoice.amount.toString()),
      statusDescription: this.extractStatusDescription(summary, invoice.status),
      dueDateStatus: this.describeDueDate(invoice.dueDate),
      paymentInstructions: this.extractSection(summary, 'Payment Instructions'),
    };

    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 3600_000 });
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  // SETTLEMENT SUMMARIES
  // ════════════════════════════════════════════════════════════════════

  async generateSettlementSummary(
    settlementId: string,
    options: AiSummaryOptions = {},
  ): Promise<SettlementSummary> {
    const cacheKey = `settlement:${settlementId}:${options.tone ?? 'professional'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as SettlementSummary;
    }

    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        merchant: { include: { user: true } },
      },
    });

    if (!settlement) {
      throw new Error(`Settlement ${settlementId} not found`);
    }

    const prompt = this.buildSettlementPrompt(settlement);
    const summary = await this.callAnthropic(prompt, options);

    const result: SettlementSummary = {
      settlementId: settlement.settlementId,
      amount: this.formatAmount(settlement.amount.toString()),
      netAmount: this.formatAmount(settlement.netAmount.toString()),
      feeBreakdown: this.describeFee(settlement.amount, settlement.feeAmount),
      statusDescription: this.extractStatusDescription(summary, settlement.status),
      nextSteps: this.extractSection(summary, 'Next Steps'),
    };

    this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 3600_000 });
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════

  private async callAnthropic(prompt: string, options: AiSummaryOptions): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxLength ?? 500,
        messages: [{ role: 'user', content: prompt }],
        system: this.getSystemPrompt(options.tone ?? 'professional'),
      } as Parameters<typeof this.anthropic.messages.create>[0]);

      // Type guard for non-streaming response
      if ('content' in response && Array.isArray(response.content)) {
        const firstBlock = response.content[0];
        if (firstBlock && 'text' in firstBlock) {
          return (firstBlock as { text: string }).text;
        }
      }
      return '';
    } catch (error) {
      this.logger.error(
        `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback: return a basic summary without AI
      return this.generateFallbackSummary(prompt);
    }
  }

  private getSystemPrompt(tone: 'professional' | 'casual' | 'technical'): string {
    return `You are EPay's AI assistant. Generate clear, ${tone} plain-language summaries
for blockchain payment data. Focus on what the user needs to know:
- What happened
- How much was involved
- What they need to do next

Keep responses concise and actionable. Use metric/imperial units appropriately.
Never make up facts — if data is missing, say so.`;
  }

  private buildMerchantPrompt(merchant: {
    businessName: string;
    businessEmail: string;
    status: string;
    verificationLevel: string;
    _count: { payments: number; invoices: number; subscriptions: number; settlements: number };
  }): string {
    return `Generate a summary for this merchant:

Business: ${merchant.businessName}
Email: ${merchant.businessEmail}
Status: ${merchant.status}
Verification: ${merchant.verificationLevel}
Payments: ${merchant._count.payments}
Invoices: ${merchant._count.invoices}
Subscriptions: ${merchant._count.subscriptions}
Settlements: ${merchant._count.settlements}

Provide:
1. Overview — who they are and their business status
2. Key Metrics — bullet list of their activity numbers
3. Recent Activity — notable patterns
4. Recommendations — optional suggestions for improvement
`;
  }

  private buildInvoicePrompt(invoice: {
    invoiceNumber: string;
    amount: bigint;
    status: string;
    dueDate: Date;
    assetCode: string;
    merchant: { businessName: string } | null;
    items: { description: string; quantity: number; unitPrice: bigint }[];
    payment: { status: string; txHash: string | null } | null;
  }): string {
    const dueDate = new Date(invoice.dueDate).toLocaleDateString();
    const items = invoice.items
      .map(
        (i) =>
          `- ${i.description}: ${i.quantity} x ${i.unitPrice} = ${i.quantity * Number(i.unitPrice)}`,
      )
      .join('\n');

    return `Generate a plain-language summary for this invoice:

Invoice: ${invoice.invoiceNumber}
Merchant: ${invoice.merchant?.businessName ?? 'Unknown'}
Amount: ${invoice.amount} ${invoice.assetCode}
Status: ${invoice.status}
Due Date: ${dueDate}
Payment: ${invoice.payment ? `Status: ${invoice.payment.status}, TX: ${invoice.payment.txHash ?? 'N/A'}` : 'Not yet paid'}

Items:
${items}

Provide:
1. Amount — human-readable with asset
2. Status Description — what the current status means
3. Due Date Status — is it overdue, due soon, or paid on time?
4. Payment Instructions — how to pay this invoice
`;
  }

  private buildSettlementPrompt(settlement: {
    settlementId: string;
    amount: bigint;
    feeAmount: bigint;
    netAmount: bigint;
    assetCode: string;
    status: string;
    periodStart: Date;
    periodEnd: Date;
    merchant: { businessName: string } | null;
  }): string {
    return `Generate a plain-language summary for this settlement:

Settlement ID: ${settlement.settlementId}
Merchant: ${settlement.merchant?.businessName ?? 'Unknown'}
Gross Amount: ${settlement.amount} ${settlement.assetCode}
Fee: ${settlement.feeAmount} ${settlement.assetCode}
Net Amount: ${settlement.netAmount} ${settlement.assetCode}
Status: ${settlement.status}
Period: ${new Date(settlement.periodStart).toLocaleDateString()} to ${new Date(settlement.periodEnd).toLocaleDateString()}

Provide:
1. Amount — gross, fee, and net in human-readable format
2. Fee Breakdown — what the fee represents
3. Status Description — what the status means
4. Next Steps — what happens next
`;
  }

  private extractSection(text: string, sectionName: string): string {
    const sections = text.split(/\n\s*\n/);
    for (const section of sections) {
      if (section.toLowerCase().includes(sectionName.toLowerCase())) {
        return section.replace(new RegExp(`^${sectionName}[:\\s]*`, 'i'), '').trim();
      }
    }
    return text.slice(0, 200);
  }

  private extractBulletList(text: string, sectionName: string): string[] {
    const section = this.extractSection(text, sectionName);
    return section
      .split(/\n/)
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  private extractStatusDescription(text: string, status: string): string {
    const statusMap: Record<string, string> = {
      DRAFT: 'This invoice is a draft and not yet visible to customers.',
      ISSUED: 'This invoice has been issued and is ready to be sent to the customer.',
      SENT: 'This invoice has been sent to the customer.',
      VIEWED: 'The customer has viewed this invoice.',
      PAID: 'This invoice has been paid in full.',
      OVERDUE: 'This invoice is past its due date and requires attention.',
      CANCELLED: 'This invoice has been cancelled and is no longer valid.',
      REFUNDED: 'This invoice has been refunded.',
    };
    return statusMap[status] ?? `Current status: ${status}`;
  }

  private describeDueDate(dueDate: Date): string {
    const now = new Date();
    const diff = new Date(dueDate).getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days <= 7) return `Due in ${days} days`;
    return `Due in ${days} days`;
  }

  private describeFee(amount: bigint, fee: bigint): string {
    const feePercent = (Number(fee) / Number(amount)) * 100;
    return `EPay fee of ${this.formatAmount(fee.toString())} (${feePercent.toFixed(2)}% of gross amount)`;
  }

  private formatAmount(amount: string): string {
    const num = new BigNumber(amount);
    return num.toFixed(7).replace(/\.?0+$/, '');
  }

  private generateFallbackSummary(prompt: string): string {
    // Extract key info without AI
    const lines = prompt.split('\n').slice(0, 10);
    return lines.join('\n');
  }
}

// Simple BigNumber implementation for formatting (avoids extra dependency)
class BigNumber {
  private value: string;

  constructor(value: string) {
    this.value = value;
  }

  toFixed(decimals: number): string {
    const [integer, fraction = ''] = this.value.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return `${integer}.${paddedFraction}`;
  }
}
