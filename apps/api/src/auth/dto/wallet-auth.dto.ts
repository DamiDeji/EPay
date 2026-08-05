import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WalletAuthDto {
  @ApiProperty({ example: 'EQD...wallet_address' })
  @IsString()
  address: string;

  @ApiProperty({ example: '...public_key' })
  @IsString()
  publicKey: string;

  @ApiProperty({ example: '0x1234abcd...' })
  @IsString()
  signature: string;

  @ApiProperty({ example: 'Login to EPay' })
  @IsString()
  message: string;
}
