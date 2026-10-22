import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ClerkWebhookController } from './clerk-webhook.controller';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ClerkWebhookController],
})
export class WebhooksModule {}
