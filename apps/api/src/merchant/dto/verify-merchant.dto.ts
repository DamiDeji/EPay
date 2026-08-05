import { IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MerchantVerificationLevel } from '@epay/types';

export class VerifyMerchantDto {
  @ApiProperty({ example: true, description: 'Approve or reject the merchant' })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({ enum: MerchantVerificationLevel })
  @IsOptional()
  @IsEnum(MerchantVerificationLevel)
  level?: MerchantVerificationLevel;
}
