import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';

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
  supportedAssets?: string[];

  @ApiPropertyOptional({ example: 'EQD...new_wallet' })
  @IsOptional()
  @IsString()
  settlementPublicKey?: string;

  @ApiPropertyOptional({ example: 'https://new-acme.com/webhooks' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
