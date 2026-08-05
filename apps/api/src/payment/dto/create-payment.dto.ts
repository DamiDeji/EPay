import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 'merchant_id_123' })
  @IsString()
  merchantId: string;

  @ApiProperty({ example: '1000000000', description: 'Amount in nanoTON' })
  @IsString()
  amount: string;

  @ApiProperty({ example: 'TON' })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ example: 'Payment for order #123' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'EQD...payer_wallet' })
  @IsOptional()
  @IsString()
  payerAddress?: string;

  @ApiProperty({ example: 'EQD...recipient_wallet' })
  @IsString()
  recipientAddress: string;

  @ApiPropertyOptional({ example: 'Order #123456' })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiPropertyOptional({ example: 3600, description: 'Expiry in seconds' })
  @IsOptional()
  expiresIn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
