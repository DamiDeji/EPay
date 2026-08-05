import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Settlements')
@Controller('settlements')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a settlement for a merchant' })
  @ApiResponse({ status: 201, description: 'Settlement created' })
  async create(@Body('merchantId') merchantId: string) {
    return this.settlementService.create(merchantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List settlements' })
  @ApiQuery({ name: 'merchantId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  async list(
    @Query('merchantId') merchantId?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.settlementService.list({ merchantId, page, pageSize, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  async getById(@Param('id') id: string) {
    const settlement = await this.settlementService.getById(id);
    if (!settlement) throw new NotFoundException('Settlement not found');
    return settlement;
  }

  @Patch(':id/process')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process a settlement' })
  async process(
    @Param('id') id: string,
    @Body('txHash') txHash: string,
    @Body('settlementAddress') settlementAddress: string,
  ) {
    return this.settlementService.process(id, txHash, settlementAddress);
  }
}
