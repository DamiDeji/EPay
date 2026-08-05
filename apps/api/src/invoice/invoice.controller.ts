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
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  async create(@Body() dto: CreateInvoiceDto) {
    return this.invoiceService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List invoices' })
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
    return this.invoiceService.list({ merchantId, page, pageSize, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getById(@Param('id') id: string) {
    const invoice = await this.invoiceService.getById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  @Patch(':id/issue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue a draft invoice' })
  async issue(@Param('id') id: string) {
    return this.invoiceService.issue(id);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Mark invoice as paid' })
  async markPaid(
    @Param('id') id: string,
    @Body('paymentId') paymentId: string,
  ) {
    return this.invoiceService.markPaid(id, paymentId);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an invoice' })
  async cancel(@Param('id') id: string) {
    return this.invoiceService.cancel(id);
  }
}
