import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { StorageService } from '../storage/storage.service';
import type { TripInviteResponse } from 'shared-types';

const inviteInclude = {
  inviter: { select: userSummarySelect },
  invitee: { select: userSummarySelect },
} satisfies Prisma.TripInviteInclude;

type InviteRow = Prisma.TripInviteGetPayload<{ include: typeof inviteInclude }>;

// Answering an invite from the inbox (#134 COLLAB-3, rules in #129 DOC-3).
// Only the invitee can answer, and only while it's pending. Sending, listing
// and cancelling invites come with the rest of COLLAB-3.
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Joins the trip as a collaborator and tells the owner. Pending invites
  // already count toward MAX_TRIP_PEOPLE, so accepting can't go over it.
  accept(viewerId: string, inviteId: string): Promise<TripInviteResponse> {
    return this.answer(viewerId, inviteId, 'accepted', async (tx, invite) => {
      await tx.tripMember.createMany({
        data: { tripId: invite.tripId, userId: viewerId },
        skipDuplicates: true,
      });
      await tx.notification.create({
        data: {
          recipientId: invite.inviterId,
          actorId: viewerId,
          type: 'trip_invite_accepted',
          tripId: invite.tripId,
        },
      });
    });
  }

  // Declining sends nothing back to the owner, who can invite again later
  decline(viewerId: string, inviteId: string): Promise<TripInviteResponse> {
    return this.answer(viewerId, inviteId, 'declined');
  }

  private async answer(
    viewerId: string,
    inviteId: string,
    status: 'accepted' | 'declined',
    then?: (
      tx: Prisma.TransactionClient,
      invite: { tripId: string; inviterId: string },
    ) => Promise<void>,
  ): Promise<TripInviteResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.tripInvite.findUnique({
        where: { id: inviteId },
        select: { tripId: true, inviterId: true, inviteeId: true },
      });
      // Someone else's invite is a 404, the same as one that doesn't exist
      if (!invite || invite.inviteeId !== viewerId) {
        throw new NotFoundException('Invite not found');
      }

      // Conditional, so answering twice, or racing the owner cancelling it,
      // can't both succeed
      const { count } = await tx.tripInvite.updateMany({
        where: { id: inviteId, status: 'pending' },
        data: { status, respondedAt: new Date() },
      });
      if (count === 0) {
        throw new ConflictException('This invite is no longer pending');
      }

      await then?.(tx, invite);
      // Answering it counts as reading it
      await tx.notification.updateMany({
        where: { inviteId, recipientId: viewerId, readAt: null },
        data: { readAt: new Date() },
      });

      return tx.tripInvite.findUniqueOrThrow({
        where: { id: inviteId },
        include: inviteInclude,
      });
    });
    return this.toResponse(row);
  }

  private async toResponse(row: InviteRow): Promise<TripInviteResponse> {
    const [inviter, invitee] = await Promise.all([
      toUserSummary(row.inviter, this.storage),
      toUserSummary(row.invitee, this.storage),
    ]);
    return {
      id: row.id,
      tripId: row.tripId,
      inviter,
      invitee,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
    };
  }
}
