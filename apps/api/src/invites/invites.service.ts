import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { StorageService } from '../storage/storage.service';
import { lockTripForShare, lockTripForUpdate } from '../trips/trip-locks';
import { MAX_TRIP_PEOPLE } from '../trips/trip-rules';
import type { TripInviteResponse, TripInvitesResponse } from 'shared-types';

const inviteInclude = {
  inviter: { select: userSummarySelect },
  invitee: { select: userSummarySelect },
} satisfies Prisma.TripInviteInclude;

type InviteRow = Prisma.TripInviteGetPayload<{ include: typeof inviteInclude }>;

// Trip invites (#134 COLLAB-3, rules in #129 DOC-3, endpoints and errors in
// docs/architecture/shared-trips.md). The owner sends, lists and cancels
// them. Only the invitee can answer, and only while it's pending.
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Invites someone by username and sends them a trip_invite notification.
  // The trip lock makes two invites at once wait for each other, and waits
  // for any accept or decline in progress (they take it FOR SHARE), so the
  // counts below can't change while they're read.
  async create(
    viewerId: string,
    tripId: string,
    username: string,
  ): Promise<TripInviteResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      // Owner check first, so nobody else can hold a lock on the trip. Then
      // again after locking, in case the trip was deleted meanwhile.
      await this.assertOwner(tx, tripId, viewerId);
      await lockTripForUpdate(tx, tripId);
      await this.assertOwner(tx, tripId, viewerId);

      const invitee = await tx.user.findUnique({
        where: { username: username.toLowerCase() },
        select: { id: true },
      });
      if (!invitee) throw new NotFoundException('User not found');
      if (invitee.id === viewerId) {
        throw new BadRequestException("You can't invite yourself");
      }

      const [isMember, hasPending, members, pending] = await Promise.all([
        tx.tripMember.count({ where: { tripId, userId: invitee.id } }),
        tx.tripInvite.count({
          where: { tripId, inviteeId: invitee.id, status: 'pending' },
        }),
        tx.tripMember.count({ where: { tripId } }),
        tx.tripInvite.count({ where: { tripId, status: 'pending' } }),
      ]);
      if (isMember > 0) {
        throw new ConflictException('They are already on this trip');
      }
      if (hasPending > 0) {
        throw new ConflictException('They already have a pending invite');
      }
      // The owner, collaborators and pending invites all count
      if (1 + members + pending >= MAX_TRIP_PEOPLE) {
        throw new ConflictException(
          `A trip has up to ${MAX_TRIP_PEOPLE} people, counting pending invites`,
        );
      }

      const invite = await tx.tripInvite.create({
        data: { tripId, inviterId: viewerId, inviteeId: invitee.id },
        include: inviteInclude,
      });
      // TODO(#132 NOTIF-1): write this through NotificationsService.create(tx, ...) once it exists
      await tx.notification.create({
        data: {
          recipientId: invitee.id,
          actorId: viewerId,
          type: 'trip_invite',
          tripId,
          inviteId: invite.id,
        },
      });
      return invite;
    });
    return this.toResponse(row);
  }

  // The trip's pending invites, newest first. Owner only.
  async listPending(
    viewerId: string,
    tripId: string,
  ): Promise<TripInvitesResponse> {
    await this.assertOwner(this.prisma, tripId, viewerId);
    const rows = await this.prisma.tripInvite.findMany({
      where: { tripId, status: 'pending' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: inviteInclude,
    });
    return { items: await Promise.all(rows.map((r) => this.toResponse(r))) };
  }

  // The owner takes back a pending invite. The invitee's notification stays
  // and shows it as cancelled, but is marked read, since there's nothing
  // left to do with it.
  async cancel(
    viewerId: string,
    inviteId: string,
  ): Promise<TripInviteResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.tripInvite.findUnique({
        where: { id: inviteId },
        select: {
          inviteeId: true,
          status: true,
          trip: { select: { ownerId: true } },
        },
      });
      if (invite?.inviteeId === viewerId) {
        // Only point them at declining while that's still possible
        if (invite.status !== 'pending') {
          throw new ConflictException('This invite is no longer pending');
        }
        throw new ForbiddenException('Decline the invite instead');
      }
      // Anyone but the owner and the invitee gets a 404, as if it didn't exist
      if (!invite || invite.trip.ownerId !== viewerId) {
        throw new NotFoundException('Invite not found');
      }

      // Conditional, like answering, so cancelling can't race an accept
      const { count } = await tx.tripInvite.updateMany({
        where: { id: inviteId, status: 'pending' },
        data: { status: 'cancelled', respondedAt: new Date() },
      });
      if (count === 0) {
        throw new ConflictException('This invite is no longer pending');
      }

      // So the invitee's unread badge doesn't count an invite they can't answer
      await tx.notification.updateMany({
        where: { inviteId, recipientId: invite.inviteeId, readAt: null },
        data: { readAt: new Date() },
      });

      return tx.tripInvite.findUniqueOrThrow({
        where: { id: inviteId },
        include: inviteInclude,
      });
    });
    return this.toResponse(row);
  }

  // Owner-only trip actions. Following the API's usual rule, a trip you can't
  // see is a 404 and one you can see but don't own is a 403. Collaborators
  // can't see drafts until #133 COLLAB-2, so this checks membership directly
  // instead of using canViewTrip.
  private async assertOwner(
    prisma: Pick<Prisma.TransactionClient, 'trip'>,
    tripId: string,
    viewerId: string,
  ) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        ownerId: true,
        status: true,
        members: { where: { userId: viewerId }, select: { userId: true } },
      },
    });
    if (trip?.ownerId === viewerId) return;
    if (trip && (trip.members.length > 0 || trip.status === 'published')) {
      throw new ForbiddenException('Only the trip owner can manage invites');
    }
    throw new NotFoundException('Trip not found');
  }

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

      // Waits for an invite being sent (which locks the trip FOR UPDATE), so
      // one can't read the people count halfway through this accept. FOR
      // SHARE, so answers to different invites still run side by side.
      await lockTripForShare(tx, invite.tripId);

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
