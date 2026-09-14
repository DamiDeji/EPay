import { Module } from '@nestjs/common';

import { ObservabilityModule } from '../observability/observability.module';

import { WebhookDispatchScheduler } from './webhook-dispatch.scheduler';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [ObservabilityModule],
  controllers: [WebhookController],
  // The scheduler is what actually drives `processDue()`; without it webhooks
  // were signed, stored, retried on paper — and never sent.
  providers: [WebhookService, WebhookDispatcherService, WebhookDispatchScheduler],
  exports: [WebhookService, WebhookDispatcherService],
})
export class WebhookModule {}
