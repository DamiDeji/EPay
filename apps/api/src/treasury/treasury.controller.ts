import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { TreasuryService } from './treasury.service';

@ApiTags('Treasury')
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get treasury balance (admin)' })
  async getBalance() {
    return this.treasuryService.getBalance();
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List treasury transactions (admin)' })
  @ApiQuery({ name: 'txType', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  async listTransactions(
    @Query('txType') txType?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.treasuryService.getTransactions({ txType, page, pageSize, status });
  }

  @Get('transactions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get treasury transaction by ID' })
  async getTransaction(@Param('id') id: string) {
    return this.treasuryService.getTransaction(id);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Record a deposit transaction' })
  @ApiResponse({ status: 201, description: 'Deposit recorded' })
  async recordDeposit(
    @Body('amount') amount: string,
    @Body('fromAddress') fromAddress: string,
    @Body('txHash') txHash: string,
  ) {
    return this.treasuryService.recordDeposit(amount, fromAddress, txHash);
  }
}
