import { generateId } from '@epay/shared';
import type { Escrow, PaginatedResponse } from '@epay/types';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type { CreateEscrowDto } from './dto/create-escrow.dto';

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEscrowDto): Promise<Escrow> {
    const escrowId = generateId('esc');

    const totalAmount = dto.milestones.reduce(
      (sum, m) => sum + BigInt(m.amount),
      BigInt(0),
    );

    const escrow = await this.prisma.escrow.create({
      data: {
        escrowId,
        merchantId: dto.merchantId,
        customerId: dto.customerId,
        amount: dto.amount ? BigInt(dto.amount) : totalAmount,
        assetCode: dto.assetCode,
        assetIssuer: dto.assetIssuer,
        status: 'CREATED',
        contractAddress: 'pending_deployment',
        metadata: (dto.metadata ?? {}) as any,
        milestones: {
          create: dto.milestones.map((m, i) => ({
            index: i,
            description: m.description,
            amount: BigInt(m.amount),
            status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
          })),
        },
      },
      include: { milestones: true },
    });

    return this.sanitizeEscrow(escrow);
  }

  async getById(id: string): Promise<Escrow | null> {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: { milestones: { orderBy: { index: 'asc' } } },
    });
    return escrow ? this.sanitizeEscrow(escrow) : null;
  }

  async list(params: {
    merchantId?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Escrow>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.merchantId) where.merchantId = params.merchantId;
    if (params.customerId) where.customerId = params.customerId;
    if (params.status) where.status = params.status;

    const [escrows, total] = await Promise.all([
      this.prisma.escrow.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { milestones: { orderBy: { index: 'asc' } } },
      }),
      this.prisma.escrow.count({ where }),
    ]);

    return {
      data: escrows.map((e) => this.sanitizeEscrow(e)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async fund(id: string, txHash: string): Promise<Escrow> {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'CREATED') {
      throw new BadRequestException('Escrow is not in CREATED state');
    }

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'FUNDED', txHash },
      include: { milestones: { orderBy: { index: 'asc' } } },
    });

    return this.sanitizeEscrow(updated);
  }

  async completeMilestone(
    id: string,
    milestoneIndex: number,
    releaseTxHash?: string,
  ): Promise<Escrow> {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: { milestones: { orderBy: { index: 'asc' } } },
    });

    if (!escrow) throw new NotFoundException('Escrow not found');
    if (!['FUNDED', 'IN_PROGRESS'].includes(escrow.status)) {
      throw new BadRequestException('Escrow not in active state');
    }

    const milestone = escrow.milestones.find((m) => m.index === milestoneIndex);
    if (!milestone) throw new NotFoundException('Milestone not found');

    await this.prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        ...(releaseTxHash && { releaseTxHash }),
      },
    });

    const isLastMilestone = milestoneIndex === escrow.milestones.length - 1;

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: {
        status: isLastMilestone ? 'COMPLETED' : 'IN_PROGRESS',
        currentMilestone: isLastMilestone ? milestoneIndex : milestoneIndex + 1,
      },
      include: { milestones: { orderBy: { index: 'asc' } } },
    });

    return this.sanitizeEscrow(updated);
  }

  async dispute(id: string): Promise<Escrow> {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'DISPUTED', disputedAt: new Date() },
      include: { milestones: { orderBy: { index: 'asc' } } },
    });

    return this.sanitizeEscrow(updated);
  }

  async resolve(id: string): Promise<Escrow> {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'DISPUTED') {
      throw new BadRequestException('Escrow is not disputed');
    }

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
      include: { milestones: { orderBy: { index: 'asc' } } },
    });

    return this.sanitizeEscrow(updated);
  }

  async cancel(id: string): Promise<Escrow> {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (!['CREATED', 'DISPUTED'].includes(escrow.status)) {
      throw new BadRequestException('Cannot cancel escrow in current state');
    }

    const updated = await this.prisma.escrow.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { milestones: { orderBy: { index: 'asc' } } },
    });

    return this.sanitizeEscrow(updated);
  }

  private sanitizeEscrow(escrow: any): Escrow {
    return {
      ...escrow,
      amount: escrow.amount.toString(),
      milestones: (escrow.milestones ?? []).map((m: any) => ({
        ...m,
        amount: m.amount.toString(),
      })),
      metadata: escrow.metadata ?? {},
    };
  }
}
