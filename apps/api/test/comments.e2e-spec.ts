import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Post, Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser } from './utils/test-app';

type CommentBody = {
  id: string;
  parentCommentId: string | null;
  replyTo: { id: string } | null;
  replyCount: number;
};

describe('Comments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let alice: User;
  let bob: User;
  let trip: Trip;
  let post: Post;

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

  async function comment(
    user: User,
    body: string,
    parentCommentId?: string,
    postId = post.id,
  ) {
    const res = await http()
      .post(`/api/posts/${postId}/comments`)
      .set(as(user))
      .send({ body, parentCommentId })
      .expect(201);
    // Comments are ordered by created_at (milliseconds), so keep test
    // comments from sharing a timestamp
    await new Promise((resolve) => setTimeout(resolve, 2));
    return res.body as CommentBody;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'author');
    alice = await createTestUser(prisma, 'alice');
    bob = await createTestUser(prisma, 'bob');
    trip = await createTrip('published');
    post = await createPost(trip.id);
  });

  afterEach(() => prisma.comment.deleteMany({ where: { postId: post.id } }));

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, alice.id, bob.id] } },
    });
    await app.close();
  });

  it('replying to a reply never makes a second level of nesting', async () => {
    const top = await comment(alice, 'What a view');
    const reply = await comment(bob, 'Right?', top.id);
    const replyToReply = await comment(alice, 'Going back next year', reply.id);

    expect(reply).toMatchObject({ parentCommentId: top.id, replyTo: null });
    expect(replyToReply).toMatchObject({
      parentCommentId: top.id,
      replyTo: { id: bob.id },
    });

    const replies = await http()
      .get(`/api/comments/${top.id}/replies`)
      .set(as(owner))
      .expect(200);
    expect(
      (replies.body as { items: CommentBody[] }).items.map((c) => c.id),
    ).toEqual([reply.id, replyToReply.id]);
  });

  it('lists top-level comments in order, with reply counts and pages', async () => {
    const first = await comment(alice, 'First');
    const second = await comment(bob, 'Second');
    await comment(bob, 'Reply', first.id);
    await comment(alice, 'Reply 2', first.id);

    const page1 = await http()
      .get(`/api/posts/${post.id}/comments?limit=1`)
      .set(as(owner))
      .expect(200);
    expect(page1.body).toEqual({
      items: [expect.objectContaining({ id: first.id, replyCount: 2 })],
      nextCursor: first.id,
    });

    const page2 = await http()
      .get(`/api/posts/${post.id}/comments`)
      .query({ limit: 1, cursor: first.id })
      .set(as(owner))
      .expect(200);
    expect(page2.body).toEqual({
      items: [expect.objectContaining({ id: second.id, replyCount: 0 })],
      nextCursor: null,
    });

    const fetched = await http()
      .get(`/api/posts/${post.id}`)
      .set(as(owner))
      .expect(200);
    expect(fetched.body).toMatchObject({ commentCount: 4 });
  });

  it('rejects comments over 500 characters and empty ones', async () => {
    const send = (body: string) =>
      http()
        .post(`/api/posts/${post.id}/comments`)
        .set(as(alice))
        .send({ body });

    await send('a'.repeat(500)).expect(201);
    const tooLong = await send('a'.repeat(501)).expect(400);
    expect((tooLong.body as { message: string }).message).toMatch(
      /500 characters/,
    );
    await send('   ').expect(400);
  });

  it('returns a clear 404 when commenting on a deleted post', async () => {
    const doomed = await createPost(trip.id);
    await prisma.post.delete({ where: { id: doomed.id } });

    const res = await http()
      .post(`/api/posts/${doomed.id}/comments`)
      .set(as(alice))
      .send({ body: 'Hello?' })
      .expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: 'Post not found',
    });
  });

  it("returns 404 for posts on someone else's draft", async () => {
    const draft = await createTrip('draft');
    const draftPost = await createPost(draft.id);
    await http()
      .post(`/api/posts/${draftPost.id}/comments`)
      .set(as(alice))
      .send({ body: 'Sneaky' })
      .expect(404);
    await http()
      .get(`/api/posts/${draftPost.id}/comments`)
      .set(as(alice))
      .expect(404);
    await prisma.trip.delete({ where: { id: draft.id } });
  });

  it('rejects a parent comment from another post', async () => {
    const otherPost = await createPost(trip.id);
    const elsewhere = await comment(
      alice,
      'Elsewhere',
      undefined,
      otherPost.id,
    );
    await http()
      .post(`/api/posts/${post.id}/comments`)
      .set(as(bob))
      .send({ body: 'Huh', parentCommentId: elsewhere.id })
      .expect(400);
    await prisma.post.delete({ where: { id: otherPost.id } });
  });

  it('only the author can delete, and deleting a top-level comment deletes its replies', async () => {
    const top = await comment(alice, 'Delete me');
    await comment(bob, 'Reply', top.id);

    // Not even the post's owner can delete someone else's comment
    await http().delete(`/api/comments/${top.id}`).set(as(owner)).expect(403);
    await http().delete(`/api/comments/${top.id}`).set(as(alice)).expect(204);

    expect(await prisma.comment.count({ where: { postId: post.id } })).toBe(0);
  });

  it('deleting an account deletes its comments but only drops mentions of it', async () => {
    const temp = await createTestUser(prisma, 'temp');
    const top = await comment(alice, 'Top');
    const tempReply = await comment(temp, 'Temp reply', top.id);
    const mention = await comment(bob, 'Reply to temp', tempReply.id);
    expect(mention.replyTo).toMatchObject({ id: temp.id });

    await prisma.user.delete({ where: { id: temp.id } });

    expect(
      await prisma.comment.findUnique({ where: { id: tempReply.id } }),
    ).toBeNull();
    const kept = await prisma.comment.findUnique({ where: { id: mention.id } });
    expect(kept).toMatchObject({
      parentCommentId: top.id,
      replyToUserId: null,
    });
  });
});
