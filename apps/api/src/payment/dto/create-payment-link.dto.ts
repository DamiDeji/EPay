import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreatePaymentLinkDto {
  @ApiProperty({ example: 'merchant_id_123' })
  @IsString()
  merchantId: string;

  @ApiProperty({ example: '1000000000' })
  @IsString()
  amount: string;

  @ApiProperty({ example: 'XLM' })
  @IsString()
  assetCode: string;

  @ApiProperty({ example: "native", description: "Asset issuer (native for XLM)" })
  @IsString()
  assetIssuer: string;

  @ApiPropertyOptional({ example: 'Payment for services' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 100, description: 'Max number of payments' })
  @IsOptional()
  @IsInt()
  maxPayments?: number;

  @ApiPropertyOptional({ example: 604800, description: 'Expiry in seconds (e.g., 7 days)' })
  @IsOptional()
  expiresIn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
