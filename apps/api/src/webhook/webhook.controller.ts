import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get('deliveries')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List webhook deliveries' })
  @ApiQuery({ name: 'merchantId', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async listDeliveries(
    @Query('merchantId') merchantId?: string,
    @Query('eventType') eventType?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.webhookService.listDeliveries({ merchantId, eventType, page, pageSize });
  }

  @Get('deliveries/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get webhook delivery by ID' })
  async getDelivery(@Param('id') id: string) {
    return this.webhookService.getDelivery(id);
  }

  @Post('deliveries/:id/retry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry a failed webhook delivery' })
  async retryDelivery(@Param('id') id: string) {
    return this.webhookService.retryDelivery(id);
  }
}
