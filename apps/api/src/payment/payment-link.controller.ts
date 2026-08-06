import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';
import { PaymentService } from './payment.service';

@ApiTags('Payment Links')
@Controller('payment-links')
export class PaymentLinkController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment link' })
  async create(@Body() dto: CreatePaymentLinkDto) {
    return this.paymentService.createPaymentLink(dto);
  }

  @Get('by-code/:code')
  @ApiOperation({ summary: 'Get payment link by code' })
  async getByCode(@Param('code') code: string) {
    return this.paymentService.getPaymentLinkByCode(code);
  }

  @Get('merchant/:merchantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List merchant payment links' })
  async listByMerchant(@Param('merchantId') merchantId: string) {
    return this.paymentService.listPaymentLinks(merchantId);
  }
}
