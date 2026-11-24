import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginationQueryDto,
  buildPage,
  keyset,
  pageLimit,
} from '../common/pagination';
import { formatDateOnly } from '../common/dates';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { StorageService } from '../storage/storage.service';
import type {
  NotificationResponse,
  PaginatedResponse,
  UnreadCountResponse,
} from 'shared-types';

// The inbox, newest first
const INBOX = keyset<
  Notification,
  Prisma.NotificationWhereInput,
  Prisma.NotificationOrderByWithRelationInput
>([
  { field: 'createdAt', direction: 'desc', type: 'date' },
  { field: 'id', direction: 'desc', type: 'uuid' },
]);

const notificationInclude = {
  actor: { select: userSummarySelect },
  trip: { select: { id: true, title: true, startDate: true, endDate: true } },
  invite: { select: { id: true, status: true } },
} satisfies Prisma.NotificationInclude;

type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

// The in-app inbox (#132 NOTIF-1). Rows are written by the features that
// cause them, e.g. accepting an invite (InvitesService). You only ever see
// your own notifications.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const list = `notifications:${userId}`;
    const limit = pageLimit(query);
    const rows = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...INBOX.after(INBOX.decode(query.cursor, list)),
      },
      include: notificationInclude,
      orderBy: INBOX.orderBy,
      take: limit + 1,
    });

    const page = buildPage(rows, limit, (row) => INBOX.cursor(list, row));
    return {
      items: await Promise.all(page.items.map((row) => this.toResponse(row))),
      nextCursor: page.nextCursor,
    };
  }

  async unreadCount(userId: string): Promise<UnreadCountResponse> {
    // Uses the partial index on recipient_id WHERE read_at IS NULL
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
    return { count };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private async toResponse(
    row: NotificationRow,
  ): Promise<NotificationResponse> {
    return {
      id: row.id,
      type: row.type,
      actor: await toUserSummary(row.actor, this.storage),
      trip: row.trip && {
        id: row.trip.id,
        title: row.trip.title,
        startDate: formatDateOnly(row.trip.startDate),
        endDate: formatDateOnly(row.trip.endDate),
      },
      invite: row.invite && { id: row.invite.id, status: row.invite.status },
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
