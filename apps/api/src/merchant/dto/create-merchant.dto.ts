import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty({ example: 'Acme Store' })
  @IsString()
  businessName: string;

  @ApiProperty({ example: 'merchant@acme.com' })
  @IsEmail()
  businessEmail: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsString()
  businessUrl?: string;

  @ApiPropertyOptional({ example: 'Online retail store' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['TON', 'USDT'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedAssets?: string[];

  @ApiPropertyOptional({ example: 'EQD...merchant_wallet' })
  @IsOptional()
  @IsString()
  settlementPublicKey?: string;

  @ApiPropertyOptional({ example: 'https://acme.com/webhooks/epay' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
