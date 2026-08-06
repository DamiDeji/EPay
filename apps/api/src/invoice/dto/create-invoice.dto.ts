import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsArray, IsOptional, IsInt, Min, IsDateString, ValidateNested } from 'class-validator';

class InvoiceItemDto {
  @ApiProperty({ example: 'Web Development Services' })
  @IsString()
  description: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: '1000000000', description: 'Unit price in nanoTON' })
  @IsString()
  unitPrice: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'merchant_id_123' })
  @IsString()
  merchantId: string;

  @ApiPropertyOptional({ example: '1000000000', description: 'Total amount in nanoTON' })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiProperty({ example: 'TON' })
  @IsString()
  assetCode: string;

  @ApiProperty({ example: "native", description: "Asset issuer (native for XLM)" })
  @IsString()
  assetIssuer: string;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiPropertyOptional({ example: '2026-09-05T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @ApiPropertyOptional({ example: 'customer_id_456' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ example: 'Please pay within 30 days' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
