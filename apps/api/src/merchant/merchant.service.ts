import type { Merchant, PaginatedResponse } from '@epay/types';
import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import type { CreateMerchantDto } from './dto/create-merchant.dto';
import type { UpdateMerchantDto } from './dto/update-merchant.dto';
import type { VerifyMerchantDto } from './dto/verify-merchant.dto';

@Injectable()
export class MerchantService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: CreateMerchantDto): Promise<Merchant> {
    const existing = await this.prisma.merchant.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('User already has a merchant account');
    }

    const merchant = await this.prisma.merchant.create({
      data: {
        userId,
        businessName: dto.businessName,
        businessEmail: dto.businessEmail,
        businessUrl: dto.businessUrl ?? null,
        description: dto.description ?? null,
        supportedAssets: dto.supportedAssets ?? ['TON'],
        settlementPublicKey: dto.settlementPublicKey ?? null,
        webhookUrl: dto.webhookUrl ?? null,
      },
    });

    return this.sanitizeMerchant(merchant);
  }

  async getById(id: string): Promise<Merchant | null> {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    return merchant ? this.sanitizeMerchant(merchant) : null;
  }

  async getByUserId(userId: string): Promise<Merchant> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.sanitizeMerchant(merchant);
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<PaginatedResponse<Merchant>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.status) where.status = params.status;

    const [merchants, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.merchant.count({ where }),
    ]);

    return {
      data: merchants.map((m) => this.sanitizeMerchant(m)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrevious: page > 1,
    };
  }

  async update(id: string, userId: string, dto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.userId !== userId) throw new ForbiddenException('Not your merchant');

    const updated = await this.prisma.merchant.update({
      where: { id },
      data: {
        ...(dto.businessName !== undefined && { businessName: dto.businessName }),
        ...(dto.businessEmail !== undefined && { businessEmail: dto.businessEmail }),
        ...(dto.businessUrl !== undefined && { businessUrl: dto.businessUrl }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.webhookUrl !== undefined && { webhookUrl: dto.webhookUrl }),
        ...(dto.settlementPublicKey !== undefined && {
          settlementPublicKey: dto.settlementPublicKey,
        }),
        ...(dto.supportedAssets !== undefined && {
          supportedAssets: dto.supportedAssets,
        }),
      },
    });

    return this.sanitizeMerchant(updated);
  }

  async verify(id: string, dto: VerifyMerchantDto): Promise<Merchant> {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const updated = await this.prisma.merchant.update({
      where: { id },
      data: {
        status: dto.approve ? 'ACTIVE' : 'REJECTED',
        verificationLevel: dto.approve ? (dto.level ?? 'VERIFIED') : merchant.verificationLevel,
      },
    });

    return this.sanitizeMerchant(updated);
  }

  async suspend(id: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    await this.prisma.merchant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }

  async reactivate(id: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    await this.prisma.merchant.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private sanitizeMerchant(merchant: any): Merchant {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { webhookSecret, ...safe } = merchant;
    return {
      ...safe,
      supportedAssets: safe.supportedAssets ?? [],
      metadata: safe.metadata ?? {},
    } as Merchant;
  }
}
