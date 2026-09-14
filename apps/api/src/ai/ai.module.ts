import { Anthropic } from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [
    {
      provide: 'AnthropicClient',
      useFactory: (config: ConfigService) => {
        const apiKey = config.getOrThrow('ANTHROPIC_API_KEY');
        return new Anthropic({ apiKey });
      },
      inject: [ConfigService],
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
