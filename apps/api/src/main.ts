import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
    {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    },
  );

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
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
    .setDescription('Decentralized Payment Gateway API on TON blockchain')
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 EPay API running on http://localhost:${port}`);
  logger.log(`📚 API Docs available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((error: Error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
