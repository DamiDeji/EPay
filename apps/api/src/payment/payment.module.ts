import { Module } from '@nestjs/common';

import { PaymentLinkController } from './payment-link.controller';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  controllers: [PaymentController, PaymentLinkController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
