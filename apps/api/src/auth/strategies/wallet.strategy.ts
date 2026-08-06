import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-custom';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WalletStrategy extends PassportStrategy(Strategy, 'wallet') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async validate(req: Request): Promise<{ sub: string; role: string }> {
    const address = req.headers['x-wallet-address'] as string | undefined;
    const signature = req.headers['x-wallet-signature'] as string | undefined;
    if (!address || !signature) {
      throw new UnauthorizedException('Wallet authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { stellarPublicKey: address },
    });

    if (!user) {
      throw new UnauthorizedException('Wallet not registered');
    }

    return { sub: user.id, role: user.role };
  }
}
