import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Keypair } from '@stellar/stellar-sdk';
import type { Request } from 'express';
import { Strategy } from 'passport-custom';

import { PrismaService } from '../../database/prisma.service';

/** Stellar public key format: G + 55 base32 chars */
const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

@Injectable()
export class WalletStrategy extends PassportStrategy(Strategy, 'wallet') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async validate(req: Request): Promise<{ sub: string; role: string }> {
    const address = req.headers['x-wallet-address'] as string | undefined;
    const signature = req.headers['x-wallet-signature'] as string | undefined;
    const message = (req.headers['x-wallet-message'] as string | undefined) ?? 'Login to EPay';

    if (!address || !signature) {
      throw new UnauthorizedException('Wallet authentication required');
    }

    // Validate Stellar public key format
    if (!STELLAR_PUBLIC_KEY_REGEX.test(address)) {
      throw new UnauthorizedException('Invalid Stellar public key format');
    }

    // Verify Ed25519 signature cryptographically
    const isSignatureValid = this.verifyStellarSignature(address, message, signature);
    if (!isSignatureValid) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    const user = await this.prisma.user.findUnique({
      where: { stellarPublicKey: address },
    });

    if (!user) {
      throw new UnauthorizedException('Wallet not registered');
    }

    return { sub: user.id, role: user.role };
  }

  /**
   * Verify an Ed25519 signature against a Stellar public key.
   */
  private verifyStellarSignature(
    publicKey: string,
    message: string,
    signature: string,
  ): boolean {
    try {
      const keypair = Keypair.fromPublicKey(publicKey);
      const dataBuffer = Buffer.from(message, 'utf-8');
      const signatureBuffer = Buffer.from(signature, 'base64');
      return keypair.verify(dataBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }
}
