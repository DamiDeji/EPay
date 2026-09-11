import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { AiService, MerchantSummary, InvoiceSummary, SettlementSummary } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('merchants/:id/summary')
  async getMerchantSummary(
    @Param('id', ParseUUIDPipe) merchantId: string,
    @Query('tone') tone?: 'professional' | 'casual' | 'technical',
  ): Promise<{ success: true; data: MerchantSummary }> {
    const options = tone ? { tone: tone as 'professional' | 'casual' | 'technical' } : {};
    const data = await this.aiService.generateMerchantSummary(merchantId, options);
    return { success: true, data };
  }

  @Get('invoices/:id/summary')
  async getInvoiceSummary(
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Query('tone') tone?: 'professional' | 'casual' | 'technical',
  ): Promise<{ success: true; data: InvoiceSummary }> {
    const options = tone ? { tone: tone as 'professional' | 'casual' | 'technical' } : {};
    const data = await this.aiService.generateInvoiceSummary(invoiceId, options);
    return { success: true, data };
  }

  @Get('settlements/:id/summary')
  async getSettlementSummary(
    @Param('id', ParseUUIDPipe) settlementId: string,
    @Query('tone') tone?: 'professional' | 'casual' | 'technical',
  ): Promise<{ success: true; data: SettlementSummary }> {
    const options = tone ? { tone: tone as 'professional' | 'casual' | 'technical' } : {};
    const data = await this.aiService.generateSettlementSummary(settlementId, options);
    return { success: true, data };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string; cached: number }> {
    return {
      status: 'ok',
      cached: this.aiService['cache'].size,
    };
  }
}
