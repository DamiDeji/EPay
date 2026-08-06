import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletAuthDto {
  @ApiProperty({ example: 'GABCDEF...stellar_public_key' })
  @IsString()
  publicKey: string;

  @ApiProperty({ example: '0x1234abcd...signature' })
  @IsString()
  signature: string;

  @ApiProperty({ example: 'Login to EPay' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: 'freighter' })
  @IsOptional()
  @IsString()
  walletProvider?: string;
}
