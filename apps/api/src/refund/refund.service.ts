import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CreateRefundDto } from './dto/create-refund.dto';
import type { Refund, PaginatedResponse } from '@epay/types';
import { generateId } from '@epay/shared';

@Injectable()
export class RefundService {
  constructor(private readonly prisma: PrismaService) {}

  async request(dto: CreateRefundDto): Promise<Refund> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException('Can only refund completed payments');
    }

    const existingRefund = await this.prisma.refund.findFirst({
      where: { paymentId: dto.paymentId },
    });
    if (existingRefund) {
      throw new BadRequestException('Refund already exists for this payment');
    }

    const refundId = generateId('ref');
    const refundAmount = BigInt(dto.amount);
    const isPartial = refundAmount < payment.amount;

    const refund = await this.prisma.refund.create({
      data: {
        refundId,
        paymentId: dto.paymentId,
        merchantId: payment.merchantId,
        amount: refundAmount,
        originalAmount: payment.amount,
        currency: payment.currency,
        status: 'REQUESTED',
        reason: dto.reason,
        isPartial,
        metadata: (dto.metadata ?? {}) as any,
      },
    });

    return this.sanitizeRefund(refund);
  }

  async getById(id: string): Promise<Refund | null> {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: { payment: true },
    });
    return refund ? this.sanitizeRefund(refund) : null;
  }

  async list(params: {
    merchantId?: string;
    paymentId?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Refund>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.merchantId) where.merchantId = params.merchantId;
    if (params.paymentId) where.paymentId = params.paymentId;
    if (params.status) where.status = params.status;

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      data: refunds.map((r) => this.sanitizeRefund(r)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async approve(id: string): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== 'REQUESTED') {
      throw new BadRequestException('Refund is not in REQUESTED state');
    }

    const updated = await this.prisma.refund.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    return this.sanitizeRefund(updated);
  }

  async process(id: string, txHash: string): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status !== 'APPROVED') {
      throw new BadRequestException('Refund is not approved');
    }

    const updated = await this.prisma.refund.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        txHash,
        processedAt: new Date(),
      },
    });

    await this.prisma.payment.update({
      where: { id: refund.paymentId },
      data: {
        status: updated.isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
      },
    });

    return this.sanitizeRefund(updated);
  }

  async reject(id: string): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException('Refund not found');

    const updated = await this.prisma.refund.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    return this.sanitizeRefund(updated);
  }

  private sanitizeRefund(refund: any): Refund {
    return {
      ...refund,
      amount: refund.amount.toString(),
      originalAmount: refund.originalAmount.toString(),
      metadata: refund.metadata ?? {},
    };
  }
}
