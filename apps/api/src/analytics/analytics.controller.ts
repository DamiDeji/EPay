import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('merchant/:merchantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get merchant analytics' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back' })
  async getMerchantAnalytics(
    @Param('merchantId') merchantId: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getMerchantAnalytics(merchantId, days ?? 30);
  }

  @Get('platform')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform-wide analytics (admin)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getPlatformAnalytics(@Query('days') days?: number) {
    return this.analyticsService.getPlatformAnalytics(days ?? 30);
  }

  @Get('merchant/:merchantId/revenue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get merchant revenue breakdown' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getMerchantRevenue(
    @Param('merchantId') merchantId: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getMerchantRevenue(merchantId, days ?? 30);
  }
}
