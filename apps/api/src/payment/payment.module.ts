import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentLinkController } from './payment-link.controller';

@Module({
  controllers: [PaymentController, PaymentLinkController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
