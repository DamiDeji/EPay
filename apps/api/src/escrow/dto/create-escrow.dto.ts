import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MilestoneDto {
  @ApiProperty({ example: 'Design phase completion' })
  @IsString()
  description: string;

  @ApiProperty({ example: '5000000000', description: 'Amount in nanoTON' })
  @IsString()
  amount: string;
}

export class CreateEscrowDto {
  @ApiProperty({ example: 'merchant_id_123' })
  @IsString()
  merchantId: string;

  @ApiProperty({ example: 'customer_id_456' })
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ example: '15000000000', description: 'Total amount in nanoTON' })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiProperty({ example: 'TON' })
  @IsString()
  currency: string;

  @ApiProperty({ type: [MilestoneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones: MilestoneDto[];

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
