import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { MerchantModule } from './merchant/merchant.module';
import { PaymentModule } from './payment/payment.module';
import { InvoiceModule } from './invoice/invoice.module';
import { EscrowModule } from './escrow/escrow.module';
import { RefundModule } from './refund/refund.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SettlementModule } from './settlement/settlement.module';
import { TreasuryModule } from './treasury/treasury.module';
import { NotificationModule } from './notification/notification.module';
import { WebhookModule } from './webhook/webhook.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
          port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) : 6379,
        },
      }),
    }),
    DatabaseModule,
    AuthModule,
    MerchantModule,
    PaymentModule,
    InvoiceModule,
    EscrowModule,
    RefundModule,
    SubscriptionModule,
    SettlementModule,
    TreasuryModule,
    NotificationModule,
    WebhookModule,
    AnalyticsModule,
    HealthModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
