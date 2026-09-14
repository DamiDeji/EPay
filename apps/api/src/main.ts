import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { attachRequestContext } from './observability/request-context.middleware';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Cast FastifyAdapter to any to avoid type incompatibility
  // between NestJS v10 core types and @nestjs/platform-fastify v11 types

  const app = await NestFactory.create(AppModule, new FastifyAdapter({ logger: true }) as any, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Request-id correlation. Registered on the Fastify instance directly (before
  // routing) so every request — including 404s — is correlatable in logs and
  // error reports, and the id is echoed back in the `x-request-id` header.

  const fastify = app.getHttpAdapter().getInstance();
  attachRequestContext(fastify);

  // Security headers with CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://*.stellar.org', 'https://stellar.expert'],
          connectSrc: [
            "'self'",
            'https://*.stellar.org',
            process.env.CORS_ORIGINS?.split(',')[0] ?? 'http://localhost:3000',
          ],
          fontSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS with strict origin validation
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-stellar-signature',
      'x-request-id',
    ],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
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

  // Rate limiting — apply uniformly across all 15 modules
  // (ThrottlerGuard is registered globally in app.module.ts)
  Logger.log('Rate limiting enabled globally via ThrottlerGuard', 'Security');

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

  const document = SwaggerModule.createDocument(app as any, config);

  SwaggerModule.setup('api/docs', app as any, document);

  // Start server
  const port = process.env.PORT ?? 4000;

  await (app as any).listen(port, '0.0.0.0');
  logger.log(`🚀 EPay API running on http://localhost:${String(port)}`);
  logger.log(`📚 API Docs available at http://localhost:${String(port)}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
