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
import { RefundService } from './refund.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Refunds')
@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a refund' })
  @ApiResponse({ status: 201, description: 'Refund requested' })
  async request(@Body() dto: CreateRefundDto) {
    return this.refundService.request(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List refunds' })
  @ApiQuery({ name: 'merchantId', required: false })
  @ApiQuery({ name: 'paymentId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  async list(
    @Query('merchantId') merchantId?: string,
    @Query('paymentId') paymentId?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.refundService.list({ merchantId, paymentId, page, pageSize, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get refund by ID' })
  async getById(@Param('id') id: string) {
    const refund = await this.refundService.getById(id);
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a refund request' })
  async approve(@Param('id') id: string) {
    return this.refundService.approve(id);
  }

  @Patch(':id/process')
  @ApiOperation({ summary: 'Process an approved refund' })
  async process(
    @Param('id') id: string,
    @Body('txHash') txHash: string,
  ) {
    return this.refundService.process(id, txHash);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a refund request' })
  async reject(@Param('id') id: string) {
    return this.refundService.reject(id);
  }
}
