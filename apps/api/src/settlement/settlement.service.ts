import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Settlement, PaginatedResponse } from '@epay/types';
import { generateId, calculateFee, calculateNetAmount } from '@epay/shared';

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async create(merchantId: string): Promise<Settlement> {
    const completedPayments = await this.prisma.payment.findMany({
      where: {
        merchantId,
        status: 'COMPLETED',
      },
    });

    if (completedPayments.length === 0) {
      throw new BadRequestException('No completed payments to settle');
    }

    const settlementId = generateId('set');
    const totalAmount = completedPayments.reduce(
      (sum, p) => sum + p.amount,
      BigInt(0),
    );
    const feeAmount = BigInt(calculateFee(totalAmount.toString(), 50));
    const netAmount = totalAmount - feeAmount;
    const paymentIds = completedPayments.map((p) => p.id);

    const settlement = await this.prisma.settlement.create({
      data: {
        settlementId,
        merchantId,
        amount: totalAmount,
        currency: 'TON',
        feeAmount,
        netAmount,
        status: 'PENDING',
        paymentIds,
        settlementAddress: 'pending',
        periodStart: completedPayments[completedPayments.length - 1]?.createdAt ?? new Date(),
        periodEnd: new Date(),
      },
    });

    return this.sanitizeSettlement(settlement);
  }

  async getById(id: string): Promise<Settlement | null> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    return settlement ? this.sanitizeSettlement(settlement) : null;
  }

  async list(params: {
    merchantId?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Settlement>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.merchantId) where.merchantId = params.merchantId;
    if (params.status) where.status = params.status;

    const [settlements, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return {
      data: settlements.map((s) => this.sanitizeSettlement(s)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async process(id: string, txHash: string, settlementAddress: string): Promise<Settlement> {
    const settlement = await this.prisma.settlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status !== 'PENDING') {
      throw new BadRequestException('Settlement is not pending');
    }

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        txHash,
        settlementAddress,
        processedAt: new Date(),
      },
    });

    return this.sanitizeSettlement(updated);
  }

  private sanitizeSettlement(settlement: any): Settlement {
    return {
      ...settlement,
      amount: settlement.amount.toString(),
      feeAmount: settlement.feeAmount.toString(),
      netAmount: settlement.netAmount.toString(),
      metadata: settlement.metadata ?? {},
    };
  }
}
