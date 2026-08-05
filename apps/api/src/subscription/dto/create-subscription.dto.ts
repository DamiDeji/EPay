import { IsString, IsOptional, IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionBillingInterval } from '@epay/types';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'merchant_id_123' })
  @IsString()
  merchantId: string;

  @ApiProperty({ example: 'customer_id_456' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: 'Premium Plan' })
  @IsString()
  planName: string;

  @ApiProperty({ example: '1000000000', description: 'Amount per period in nanoTON' })
  @IsString()
  amount: string;

  @ApiProperty({ example: 'TON' })
  @IsString()
  currency: string;

  @ApiProperty({ enum: SubscriptionBillingInterval, example: SubscriptionBillingInterval.MONTHLY })
  @IsEnum(SubscriptionBillingInterval)
  interval: SubscriptionBillingInterval;

  @ApiPropertyOptional({ example: 14, description: 'Trial period in days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ example: 12, description: 'Maximum number of payments' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPayments?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
