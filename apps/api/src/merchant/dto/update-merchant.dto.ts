import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMerchantDto {
  @ApiPropertyOptional({ example: 'Acme Store Updated' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ example: 'new-email@acme.com' })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiPropertyOptional({ example: 'https://new-acme.com' })
  @IsOptional()
  @IsString()
  businessUrl?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['TON', 'USDT', 'USDC'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedCurrencies?: string[];

  @ApiPropertyOptional({ example: 'EQD...new_wallet' })
  @IsOptional()
  @IsString()
  settlementAddress?: string;

  @ApiPropertyOptional({ example: 'https://new-acme.com/webhooks' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
