import { generateId, isExpired } from '@epay/shared';
import type { Payment, PaymentLink, PaginatedResponse } from '@epay/types';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type { CreatePaymentLinkDto } from './dto/create-payment-link.dto';
import type { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const paymentId = generateId('pay');
    const expiresIn = dto.expiresIn ?? 3600;

    const payment = await this.prisma.payment.create({
      data: {
        paymentId,
        merchantId: dto.merchantId,
        amount: BigInt(dto.amount),
        assetCode: dto.assetCode,
        assetIssuer: dto.assetIssuer,
        description: dto.description ?? null,
        payerPublicKey: dto.payerPublicKey ?? null,
        recipientPublicKey: dto.recipientPublicKey,
        memo: dto.memo ?? null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        metadata: (dto.metadata ?? {}) as any,
      },
    });

    return this.sanitizePayment(payment);
  }

  async getById(id: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { merchant: true },
    });
    return payment ? this.sanitizePayment(payment) : null;
  }

  async getByPaymentId(paymentId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { paymentId },
      include: { merchant: true },
    });
    return payment ? this.sanitizePayment(payment) : null;
  }

  async list(params: {
    merchantId?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Payment>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.merchantId) where.merchantId = params.merchantId;
    if (params.status) where.status = params.status;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => this.sanitizePayment(p)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async confirm(id: string, txHash: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Payment is not in PENDING state');
    }
    if (isExpired(payment.expiresAt)) {
      throw new BadRequestException('Payment has expired');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        txHash,
        confirmedAt: new Date(),
      },
    });

    return this.sanitizePayment(updated);
  }

  async complete(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'CONFIRMED') {
      throw new BadRequestException('Payment is not confirmed');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return this.sanitizePayment(updated);
  }

  async fail(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: 'FAILED' },
    });

    return this.sanitizePayment(updated);
  }

  async cancel(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!['PENDING', 'PROCESSING'].includes(payment.status)) {
      throw new BadRequestException('Cannot cancel payment in current state');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return this.sanitizePayment(updated);
  }

  // Payment Links
  async createPaymentLink(dto: CreatePaymentLinkDto): Promise<PaymentLink> {
    const code = generateId('link').slice(0, 12);
    const url = `${process.env.API_URL ?? 'http://localhost:4000'}/pay/${code}`;

    const link = await this.prisma.paymentLink.create({
      data: {
        merchantId: dto.merchantId,
        url,
        code,
        amount: BigInt(dto.amount),
        assetCode: dto.assetCode,
        assetIssuer: dto.assetIssuer,
        description: dto.description ?? null,
        maxPayments: dto.maxPayments ?? null,
        expiresAt: dto.expiresIn ? new Date(Date.now() + dto.expiresIn * 1000) : null,
        metadata: (dto.metadata ?? {}) as any,
      },
    });

    return this.sanitizePaymentLink(link);
  }

  async getPaymentLinkByCode(code: string): Promise<PaymentLink | null> {
    const link = await this.prisma.paymentLink.findUnique({ where: { code } });
    return link ? this.sanitizePaymentLink(link) : null;
  }

  async listPaymentLinks(merchantId: string): Promise<PaymentLink[]> {
    const links = await this.prisma.paymentLink.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((l) => this.sanitizePaymentLink(l));
  }

  private sanitizePayment(payment: any): Payment {
    return {
      ...payment,
      amount: payment.amount.toString(),
      metadata: payment.metadata ?? {},
    };
  }

  private sanitizePaymentLink(link: any): PaymentLink {
    return {
      ...link,
      amount: link.amount.toString(),
      metadata: link.metadata ?? {},
    };
  }
}
