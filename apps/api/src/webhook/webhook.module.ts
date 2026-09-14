import { Module } from '@nestjs/common';

import { WebhookController } from './webhook.controller';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService, WebhookDispatcherService],
  exports: [WebhookService, WebhookDispatcherService],
})
export class WebhookModule {}
