import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Anthropic } from '@anthropic-ai/sdk';

import { AiService } from './ai.service';
import { AiController } from './ai.controller';

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
