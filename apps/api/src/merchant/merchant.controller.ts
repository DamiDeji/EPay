import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { VerifyMerchantDto } from './dto/verify-merchant.dto';
import { MerchantService } from './merchant.service';


@ApiTags('Merchants')
@Controller('merchants')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new merchant' })
  @ApiResponse({ status: 201, description: 'Merchant registered' })
  @ApiResponse({ status: 409, description: 'User already has a merchant account' })
  async register(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateMerchantDto,
  ) {
    return this.merchantService.register(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all merchants (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'INACTIVE'] })
  async list(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.merchantService.list({ page, pageSize, status } as any);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user merchant profile' })
  async getMyMerchant(@CurrentUser('sub') userId: string) {
    return this.merchantService.getByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get merchant by ID' })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async getById(@Param('id') id: string) {
    const merchant = await this.merchantService.getById(id);
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update merchant profile' })
  async update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantService.update(id, userId, dto);
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VERIFIER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a merchant (admin/verifier)' })
  async verify(
    @Param('id') id: string,
    @Body() dto: VerifyMerchantDto,
  ) {
    return this.merchantService.verify(id, dto);
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VERIFIER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspend a merchant (admin/verifier)' })
  async suspend(@Param('id') id: string) {
    await this.merchantService.suspend(id);
  }

  @Patch(':id/reactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VERIFIER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a suspended merchant (admin/verifier)' })
  async reactivate(@Param('id') id: string) {
    await this.merchantService.reactivate(id);
  }
}
