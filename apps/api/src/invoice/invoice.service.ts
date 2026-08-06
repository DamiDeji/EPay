import type { Invoice, PaginatedResponse } from '@epay/types';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + BigInt(item.unitPrice) * BigInt(item.quantity),
      BigInt(0),
    );

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        merchantId: dto.merchantId,
        customerId: dto.customerId ?? null,
        amount: dto.amount ? BigInt(dto.amount) : totalAmount,
        assetCode: dto.assetCode,
        assetIssuer: dto.assetIssuer,
        status: 'DRAFT',
        dueDate: dto.dueDate ?? new Date(Date.now() + 30 * 86400_000),
        notes: dto.notes ?? null,
        metadata: (dto.metadata ?? {}) as any,
        items: {
          create: dto.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: BigInt(item.unitPrice),
            total: BigInt(item.unitPrice) * BigInt(item.quantity),
          })),
        },
      },
      include: { items: true },
    });

    return this.sanitizeInvoice(invoice);
  }

  async getById(id: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    return invoice ? this.sanitizeInvoice(invoice) : null;
  }

  async list(params: {
    merchantId?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Invoice>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.merchantId) where.merchantId = params.merchantId;
    if (params.status) where.status = params.status;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((i) => this.sanitizeInvoice(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async issue(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Invoice is not in DRAFT state');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'ISSUED' },
      include: { items: true },
    });

    return this.sanitizeInvoice(updated);
  }

  async markPaid(id: string, paymentId: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['ISSUED', 'PARTIALLY_PAID', 'SENT'].includes(invoice.status)) {
      throw new BadRequestException('Invoice cannot be paid in current state');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentId,
        paidAmount: invoice.amount,
        paidAt: new Date(),
      },
      include: { items: true },
    });

    return this.sanitizeInvoice(updated);
  }

  async cancel(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['DRAFT', 'ISSUED', 'SENT'].includes(invoice.status)) {
      throw new BadRequestException('Cannot cancel invoice in current state');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });

    return this.sanitizeInvoice(updated);
  }

  private sanitizeInvoice(invoice: any): Invoice {
    return {
      ...invoice,
      amount: invoice.amount.toString(),
      paidAmount: invoice.paidAmount?.toString() ?? null,
      items: (invoice.items ?? []).map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
        total: item.total.toString(),
      })),
      metadata: invoice.metadata ?? {},
    };
  }
}
