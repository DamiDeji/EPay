import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({ example: 'payment_id_123' })
  @IsString()
  paymentId: string;

  @ApiProperty({ example: '1000000000', description: 'Refund amount in nanoTON' })
  @IsString()
  amount: string;

  @ApiProperty({ example: 'Customer requested refund' })
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
