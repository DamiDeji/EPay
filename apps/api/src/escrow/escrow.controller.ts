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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateEscrowDto } from './dto/create-escrow.dto';
import { EscrowService } from './escrow.service';

@ApiTags('Escrow')
@Controller('escrows')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new escrow' })
  @ApiResponse({ status: 201, description: 'Escrow created' })
  async create(@Body() dto: CreateEscrowDto) {
    return this.escrowService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List escrows' })
  @ApiQuery({ name: 'merchantId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  async list(
    @Query('merchantId') merchantId?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.escrowService.list({ merchantId, customerId, page, pageSize, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get escrow by ID' })
  async getById(@Param('id') id: string) {
    const escrow = await this.escrowService.getById(id);
    if (!escrow) throw new NotFoundException('Escrow not found');
    return escrow;
  }

  @Patch(':id/fund')
  @ApiOperation({ summary: 'Mark escrow as funded with transaction hash' })
  async fund(@Param('id') id: string, @Body('txHash') txHash: string) {
    return this.escrowService.fund(id, txHash);
  }

  @Patch(':id/milestones/:milestoneIndex/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete a milestone' })
  async completeMilestone(
    @Param('id') id: string,
    @Param('milestoneIndex') milestoneIndex: number,
    @Body('releaseTxHash') releaseTxHash?: string,
  ) {
    return this.escrowService.completeMilestone(id, Number(milestoneIndex), releaseTxHash);
  }

  @Patch(':id/dispute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispute an escrow' })
  async dispute(@Param('id') id: string) {
    return this.escrowService.dispute(id);
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve an escrow dispute' })
  async resolve(@Param('id') id: string) {
    return this.escrowService.resolve(id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an escrow' })
  async cancel(@Param('id') id: string) {
    return this.escrowService.cancel(id);
  }
}
