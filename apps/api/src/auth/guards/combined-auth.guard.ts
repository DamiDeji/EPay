import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const apiKey = request.headers['x-api-key'];
    const walletSig = request.headers['x-wallet-signature'];

    // Presence check only: the JWT, API-key and wallet guards do the actual
    // verification. An *empty* header must not count as a credential, which is
    // why this tests for a non-empty string rather than using `??` — `'' ?? x`
    // yields `''`, i.e. "present", and would fail open.
    return [authHeader, apiKey, walletSig].some(
      (value): boolean => typeof value === 'string' && value.length > 0,
    );
  }
}
