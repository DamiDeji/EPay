import type { TreasuryTransaction, PaginatedResponse } from '@epay/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(): Promise<{
    protocolBalance: string;
    feeBalance: string;
    escrowBalance: string;
    totalBalance: string;
  }> {
    const transactions = await this.prisma.treasuryTransaction.findMany({
      where: { status: 'COMPLETED' },
    });

    let deposits = BigInt(0);
    let fees = BigInt(0);
    let escrowHeld = BigInt(0);
    let escrowReleased = BigInt(0);
    let withdrawals = BigInt(0);

    for (const tx of transactions) {
      switch (tx.txType) {
        case 'DEPOSIT':
          deposits += tx.amount;
          break;
        case 'FEE_COLLECTION':
          fees += tx.amount;
          break;
        case 'ESCROW_HOLD':
          escrowHeld += tx.amount;
          break;
        case 'ESCROW_RELEASE':
          escrowReleased += tx.amount;
          break;
        case 'WITHDRAWAL':
          withdrawals += tx.amount;
          break;
      }
    }

    const protocolBalance = deposits - withdrawals - escrowHeld + escrowReleased;
    const escrowBalance = escrowHeld - escrowReleased;

    return {
      protocolBalance: protocolBalance.toString(),
      feeBalance: fees.toString(),
      escrowBalance: escrowBalance.toString(),
      totalBalance: (protocolBalance + fees + escrowBalance).toString(),
    };
  }

  async getTransactions(params: {
    txType?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<TreasuryTransaction>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.txType) where.txType = params.txType;
    if (params.status) where.status = params.status;

    const [transactions, total] = await Promise.all([
      this.prisma.treasuryTransaction.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.treasuryTransaction.count({ where }),
    ]);

    return {
      data: transactions.map((t) => this.sanitizeTransaction(t)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async getTransaction(id: string): Promise<TreasuryTransaction | null> {
    const tx = await this.prisma.treasuryTransaction.findUnique({
      where: { id },
    });
    return tx ? this.sanitizeTransaction(tx) : null;
  }

  async recordDeposit(amount: string, fromPublicKey: string, txHash: string): Promise<TreasuryTransaction> {
    const tx = await this.prisma.treasuryTransaction.create({
      data: {
        txType: 'DEPOSIT',
        amount: BigInt(amount),
        assetCode: 'XLM',
        assetIssuer: 'native',
        fromPublicKey,
        txHash,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return this.sanitizeTransaction(tx);
  }

  async recordFeeCollection(amount: string, referenceId?: string): Promise<TreasuryTransaction> {
    const tx = await this.prisma.treasuryTransaction.create({
      data: {
        txType: 'FEE_COLLECTION',
        amount: BigInt(amount),
        assetCode: 'XLM',
        assetIssuer: 'native',
        status: 'COMPLETED',
        referenceId: referenceId ?? null,
        referenceType: referenceId ? 'PAYMENT' : null,
        completedAt: new Date(),
      },
    });

    return this.sanitizeTransaction(tx);
  }

  private sanitizeTransaction(tx: any): TreasuryTransaction {
    return {
      ...tx,
      amount: tx.amount.toString(),
      metadata: tx.metadata ?? {},
    };
  }
}
