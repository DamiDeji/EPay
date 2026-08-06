import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production API Key' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'merchant_id_123' })
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiProperty({ example: ['read:payments', 'write:payments'], isArray: true, type: String })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
