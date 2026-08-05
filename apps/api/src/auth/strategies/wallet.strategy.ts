import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { PrismaService } from '../../database/prisma.service';
import type { Request } from 'express';

@Injectable()
export class WalletStrategy extends PassportStrategy(Strategy, 'wallet') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async validate(req: Request): Promise<{ sub: string; role: string }> {
    const address = req.headers['x-wallet-address'] as string | undefined;
    const signature = req.headers['x-wallet-signature'] as string | undefined;
    const message = req.headers['x-wallet-message'] as string | undefined;

    if (!address || !signature) {
      throw new UnauthorizedException('Wallet authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { walletAddress: address },
    });

    if (!user) {
      throw new UnauthorizedException('Wallet not registered');
    }

    return { sub: user.id, role: user.role };
  }
}
