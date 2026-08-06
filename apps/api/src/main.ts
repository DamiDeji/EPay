import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Cast FastifyAdapter to any to avoid type incompatibility
  // between NestJS v10 core types and @nestjs/platform-fastify v11 types
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter({ logger: true }) as any,
    {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    },
  );

  // Security
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  (app as any).use(helmet());

  // CORS
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  (app as any).enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  (app as any).useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('EPay API')
    .setDescription('Decentralized Payment Gateway API on Stellar blockchain')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .addTag('Payments', 'Payment operations')
    .addTag('Merchants', 'Merchant management')
    .addTag('Invoices', 'Invoice lifecycle')
    .addTag('Escrow', 'Escrow management')
    .addTag('Refunds', 'Refund processing')
    .addTag('Subscriptions', 'Subscription billing')
    .addTag('Treasury', 'Treasury operations')
    .addTag('Settlements', 'Settlement processing')
    .addTag('Webhooks', 'Webhook management')
    .addTag('Analytics', 'Analytics and reporting')
    .build();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const document = SwaggerModule.createDocument(app as any, config);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  SwaggerModule.setup('api/docs', app as any, document);

  // Start server
  const port = process.env.PORT ?? 4000;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await (app as any).listen(port, '0.0.0.0');
  logger.log(`🚀 EPay API running on http://localhost:${String(port)}`);
  logger.log(`📚 API Docs available at http://localhost:${String(port)}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
