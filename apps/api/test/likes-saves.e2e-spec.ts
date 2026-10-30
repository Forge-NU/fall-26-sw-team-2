import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Post, Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser } from './utils/test-app';

type Page<T> = { items: T[]; nextCursor: string | null };
type LikerBody = { id: string; isFollowing: boolean; likedAt: string };

describe('Likes and saves (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let liker: User;
  let other: User;
  let trip: Trip;
  let draft: Trip;
  let post: Post;
  let draftPost: Post;

  const as = (user: User) => ({ 'x-test-user': user.id });
  const http = () => request(app.getHttpServer());

  async function createTrip(status: 'draft' | 'published') {
    return prisma.trip.create({
      data: {
        ownerId: owner.id,
        title: status,
        destination: 'Lisbon, Portugal',
        startDate: new Date('2026-09-12'),
        endDate: new Date('2026-09-16'),
        status,
        publishedAt: status === 'published' ? new Date() : null,
      },
    });
  }

  function createPost(tripId: string) {
    return prisma.post.create({
      data: {
        tripId,
        visitedOn: new Date('2026-09-13'),
        customLocationName: 'Somewhere',
      },
    });
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'author');
    liker = await createTestUser(prisma, 'liker');
    other = await createTestUser(prisma, 'other');
    trip = await createTrip('published');
    draft = await createTrip('draft');
    post = await createPost(trip.id);
    draftPost = await createPost(draft.id);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, liker.id, other.id] } },
    });
    await app.close();
  });

  describe('likes', () => {
    afterEach(() => prisma.postLike.deleteMany({ where: { postId: post.id } }));

    it('double-tapping like makes one row and the count stays at 1', async () => {
      const [first, second] = await Promise.all([
        http().post(`/api/posts/${post.id}/like`).set(as(liker)).expect(200),
        http().post(`/api/posts/${post.id}/like`).set(as(liker)).expect(200),
      ]);
      expect(first.body).toEqual({ liked: true, likeCount: 1 });
      expect(second.body).toEqual({ liked: true, likeCount: 1 });
      expect(await prisma.postLike.count({ where: { postId: post.id } })).toBe(
        1,
      );
    });

    it('unliking is idempotent', async () => {
      await http().post(`/api/posts/${post.id}/like`).set(as(liker));
      for (let i = 0; i < 2; i++) {
        const res = await http()
          .delete(`/api/posts/${post.id}/like`)
          .set(as(liker))
          .expect(200);
        expect(res.body).toEqual({ liked: false, likeCount: 0 });
      }
    });

    it('shows the count and likedByMe on the post', async () => {
      await http().post(`/api/posts/${post.id}/like`).set(as(liker));

      const mine = await http()
        .get(`/api/posts/${post.id}`)
        .set(as(liker))
        .expect(200);
      expect(mine.body).toMatchObject({ likeCount: 1, likedByMe: true });

      const theirs = await http()
        .get(`/api/posts/${post.id}`)
        .set(as(other))
        .expect(200);
      expect(theirs.body).toMatchObject({ likeCount: 1, likedByMe: false });
    });

    it('lists who liked a post, newest first, in pages', async () => {
      await http().post(`/api/posts/${post.id}/like`).set(as(liker));
      await http().post(`/api/posts/${post.id}/like`).set(as(other));
      await prisma.follow.create({
        data: { followerId: owner.id, followingId: other.id },
      });

      const first = await http()
        .get(`/api/posts/${post.id}/likes?limit=1`)
        .set(as(owner))
        .expect(200);
      const firstPage = first.body as Page<LikerBody>;
      expect(firstPage.items).toEqual([
        expect.objectContaining({ id: other.id, isFollowing: true }),
      ]);
      expect(firstPage.nextCursor).toBe(other.id);

      const second = await http()
        .get(`/api/posts/${post.id}/likes`)
        .query({ limit: 1, cursor: firstPage.nextCursor })
        .set(as(owner))
        .expect(200);
      expect(second.body).toEqual({
        items: [expect.objectContaining({ id: liker.id, isFollowing: false })],
        nextCursor: null,
      });

      await prisma.follow.deleteMany({ where: { followerId: owner.id } });
    });

    it("rejects a likes cursor that isn't a like on the post", async () => {
      await http()
        .get(`/api/posts/${post.id}/likes`)
        .query({ cursor: 'user_nobody' })
        .set(as(owner))
        .expect(400);
    });

    it("returns 404 for a post on someone else's draft", async () => {
      await http()
        .post(`/api/posts/${draftPost.id}/like`)
        .set(as(liker))
        .expect(404);
      await http()
        .get(`/api/posts/${draftPost.id}/likes`)
        .set(as(liker))
        .expect(404);
    });
  });

  describe('saves', () => {
    afterEach(async () => {
      await prisma.tripSave.deleteMany({ where: { userId: liker.id } });
      await prisma.postSave.deleteMany({ where: { userId: liker.id } });
    });

    it('saving a trip twice keeps one row, and unsaving is idempotent', async () => {
      await Promise.all([
        http().post(`/api/trips/${trip.id}/save`).set(as(liker)).expect(200),
        http().post(`/api/trips/${trip.id}/save`).set(as(liker)).expect(200),
      ]);
      expect(await prisma.tripSave.count({ where: { tripId: trip.id } })).toBe(
        1,
      );

      for (let i = 0; i < 2; i++) {
        const res = await http()
          .delete(`/api/trips/${trip.id}/save`)
          .set(as(liker))
          .expect(200);
        expect(res.body).toEqual({ saved: false, saveCount: 0 });
      }
    });

    it('shows the count and savedByMe on trips and posts', async () => {
      await http().post(`/api/trips/${trip.id}/save`).set(as(liker));
      await http().post(`/api/posts/${post.id}/save`).set(as(liker));

      const savedTrip = await http()
        .get(`/api/trips/${trip.id}`)
        .set(as(liker))
        .expect(200);
      expect(savedTrip.body).toMatchObject({ saveCount: 1, savedByMe: true });

      const savedPost = await http()
        .get(`/api/posts/${post.id}`)
        .set(as(other))
        .expect(200);
      expect(savedPost.body).toMatchObject({ saveCount: 1, savedByMe: false });
    });

    it('lists your own saved trips and posts, most recent first', async () => {
      const second = await createPost(trip.id);
      // Explicit times, so the order doesn't depend on two saves in the same ms
      await prisma.postSave.createMany({
        data: [
          { userId: liker.id, postId: post.id, createdAt: new Date(1000) },
          { userId: liker.id, postId: second.id, createdAt: new Date(2000) },
        ],
      });
      await http().post(`/api/trips/${trip.id}/save`).set(as(liker));

      const posts = await http()
        .get('/api/me/saved/posts?limit=1')
        .set(as(liker))
        .expect(200);
      expect(posts.body).toMatchObject({
        items: [{ id: second.id, savedByMe: true }],
        nextCursor: second.id,
      });
      const rest = await http()
        .get('/api/me/saved/posts')
        .query({ limit: 1, cursor: second.id })
        .set(as(liker))
        .expect(200);
      expect(rest.body).toMatchObject({
        items: [{ id: post.id }],
        nextCursor: null,
      });

      const trips = await http()
        .get('/api/me/saved/trips')
        .set(as(liker))
        .expect(200);
      expect(trips.body).toMatchObject({
        items: [{ id: trip.id, savedByMe: true }],
        nextCursor: null,
      });

      await prisma.post.delete({ where: { id: second.id } });
    });

    it("nobody can read another user's saved list", async () => {
      await http().post(`/api/trips/${trip.id}/save`).set(as(liker));
      await http().post(`/api/posts/${post.id}/save`).set(as(liker));

      // /me is always the caller, so `other` only ever sees their own (empty) list
      const trips = await http()
        .get('/api/me/saved/trips')
        .set(as(other))
        .expect(200);
      expect(trips.body).toEqual({ items: [], nextCursor: null });

      // ...and can't page into someone else's saves with their cursor
      await http()
        .get('/api/me/saved/posts')
        .query({ cursor: post.id })
        .set(as(other))
        .expect(400);
    });

    it("returns 404 when saving someone else's draft", async () => {
      await http()
        .post(`/api/trips/${draft.id}/save`)
        .set(as(liker))
        .expect(404);
      await http()
        .post(`/api/posts/${draftPost.id}/save`)
        .set(as(liker))
        .expect(404);
    });
  });

  describe('deletes cascade', () => {
    it('deleting a user deletes their likes and saves', async () => {
      const temp = await createTestUser(prisma, 'temp');
      await http().post(`/api/posts/${post.id}/like`).set(as(temp));
      await http().post(`/api/posts/${post.id}/save`).set(as(temp));
      await http().post(`/api/trips/${trip.id}/save`).set(as(temp));

      await prisma.user.delete({ where: { id: temp.id } });

      const where = { userId: temp.id };
      expect(await prisma.postLike.count({ where })).toBe(0);
      expect(await prisma.postSave.count({ where })).toBe(0);
      expect(await prisma.tripSave.count({ where })).toBe(0);
    });

    it('deleting a trip deletes the likes and saves on it and its posts', async () => {
      const doomed = await createTrip('published');
      const doomedPost = await createPost(doomed.id);
      await http().post(`/api/posts/${doomedPost.id}/like`).set(as(liker));
      await http().post(`/api/posts/${doomedPost.id}/save`).set(as(liker));
      await http().post(`/api/trips/${doomed.id}/save`).set(as(liker));

      await http().delete(`/api/trips/${doomed.id}`).set(as(owner)).expect(204);

      expect(
        await prisma.postLike.count({ where: { postId: doomedPost.id } }),
      ).toBe(0);
      expect(
        await prisma.postSave.count({ where: { postId: doomedPost.id } }),
      ).toBe(0);
      expect(
        await prisma.tripSave.count({ where: { tripId: doomed.id } }),
      ).toBe(0);
    });
  });
});
