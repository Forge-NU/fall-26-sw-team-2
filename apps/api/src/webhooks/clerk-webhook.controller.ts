import {
  BadRequestException,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { verifyWebhook, type WebhookEvent } from '@clerk/backend/webhooks';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Controller('webhooks/clerk')
export class ClerkWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const signingSecret = process.env['CLERK_WEBHOOK_SIGNING_SECRET'];
    if (!signingSecret) {
      throw new InternalServerErrorException('Clerk webhook is not configured');
    }
    if (!request.rawBody) {
      throw new BadRequestException('Missing raw webhook body');
    }

    let event: WebhookEvent;
    try {
      event = await verifyWebhook(
        new globalThis.Request(
          `${request.protocol}://${request.get('host')}${request.originalUrl}`,
          {
            method: request.method,
            headers: request.headers as HeadersInit,
            body: request.rawBody.toString('utf8'),
          },
        ),
        { signingSecret },
      );
    } catch {
      throw new BadRequestException('Invalid Clerk webhook signature');
    }

    if (event.type === 'user.created' || event.type === 'user.updated') {
      const clerkUser = event.data;
      const primaryEmail = clerkUser.email_addresses.find(
        (email) => email.id === clerkUser.primary_email_address_id,
      )?.email_address;

      // Upsert makes Clerk retries idempotent and preserves onboarding values
      // if the user reaches the app before this event is delivered.
      await this.prisma.user.upsert({
        where: { id: clerkUser.id },
        create: {
          id: clerkUser.id,
          email: primaryEmail ?? null,
          firstName: clerkUser.first_name ?? '',
          lastName: clerkUser.last_name ?? '',
          username: null,
          avatarUrl: clerkUser.image_url || null,
        },
        update: {
          email: primaryEmail ?? null,
          avatarUrl: clerkUser.image_url || null,
        },
      });
    } else if (event.type === 'user.deleted' && event.data.id) {
      const userId = event.data.id;
      const media = await this.prisma.postMedia.findMany({
        where: { post: { trip: { ownerId: userId } } },
        select: { s3Key: true },
      });
      await this.storage.deleteObjectsStrict(media.map((item) => item.s3Key));
      await this.prisma.user.deleteMany({ where: { id: userId } });
    }

    return { received: true };
  }
}
