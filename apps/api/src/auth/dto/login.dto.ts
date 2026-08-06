import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'securePassword123' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'GABCDEF...stellar_public_key' })
  @IsOptional()
  @IsString()
  stellarPublicKey?: string;

  @ApiPropertyOptional({ example: '0x1234abcd...' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({ example: 'Login to EPay' })
  @IsOptional()
  @IsString()
  message?: string;
}
