import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SavesService } from './saves.service';

const tripId = '11111111-1111-4111-8111-111111111111';
const postId = '22222222-2222-4222-8222-222222222222';
const ownerId = 'user_owner';
const viewerId = 'user_viewer';

const published = { ownerId, status: 'published' };
const draft = { ownerId, status: 'draft' };

describe('SavesService', () => {
  let service: SavesService;

  const prisma = {
    trip: { findUnique: jest.fn() },
    post: { findUnique: jest.fn() },
    tripSave: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    postSave: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.trip.findUnique.mockResolvedValue(published);
    prisma.post.findUnique.mockResolvedValue({ trip: published });
    prisma.tripSave.count.mockResolvedValue(1);
    prisma.postSave.count.mockResolvedValue(1);

    const module = await Test.createTestingModule({
      providers: [SavesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SavesService);
  });

  describe('trips', () => {
    it('saves with ON CONFLICT DO NOTHING and returns the count', async () => {
      await expect(service.saveTrip(viewerId, tripId)).resolves.toEqual({
        saved: true,
        saveCount: 1,
      });
      expect(prisma.tripSave.createMany).toHaveBeenCalledWith({
        data: { userId: viewerId, tripId },
        skipDuplicates: true,
      });
    });

    it('unsaves without checking the save exists', async () => {
      prisma.tripSave.count.mockResolvedValue(0);
      await expect(service.unsaveTrip(viewerId, tripId)).resolves.toEqual({
        saved: false,
        saveCount: 0,
      });
      expect(prisma.tripSave.deleteMany).toHaveBeenCalledWith({
        where: { userId: viewerId, tripId },
      });
    });

    it("returns 404 for someone else's draft", async () => {
      prisma.trip.findUnique.mockResolvedValue(draft);
      await expect(service.saveTrip(viewerId, tripId)).rejects.toThrow(
        'Trip not found',
      );
      expect(prisma.tripSave.createMany).not.toHaveBeenCalled();
    });

    it("returns 404 for a trip that doesn't exist", async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(service.unsaveTrip(viewerId, tripId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 when the trip is deleted mid-request', async () => {
      prisma.tripSave.createMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );
      await expect(service.saveTrip(viewerId, tripId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('posts', () => {
    it('saves with ON CONFLICT DO NOTHING and returns the count', async () => {
      await expect(service.savePost(viewerId, postId)).resolves.toEqual({
        saved: true,
        saveCount: 1,
      });
      expect(prisma.postSave.createMany).toHaveBeenCalledWith({
        data: { userId: viewerId, postId },
        skipDuplicates: true,
      });
    });

    it('unsaves without checking the save exists', async () => {
      await service.unsavePost(viewerId, postId);
      expect(prisma.postSave.deleteMany).toHaveBeenCalledWith({
        where: { userId: viewerId, postId },
      });
    });

    it("returns 404 for a post on someone else's draft", async () => {
      prisma.post.findUnique.mockResolvedValue({ trip: draft });
      await expect(service.savePost(viewerId, postId)).rejects.toThrow(
        'Post not found',
      );
      expect(prisma.postSave.createMany).not.toHaveBeenCalled();
    });

    it('lets the owner save a post on their own draft', async () => {
      prisma.post.findUnique.mockResolvedValue({ trip: draft });
      await expect(service.savePost(ownerId, postId)).resolves.toMatchObject({
        saved: true,
      });
    });

    it("returns 404 for a post that doesn't exist", async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(service.unsavePost(viewerId, postId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
