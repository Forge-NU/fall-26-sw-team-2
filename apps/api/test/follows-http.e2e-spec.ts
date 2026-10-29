import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FollowsController } from '../src/follows/follows.controller';
import { FollowsService } from '../src/follows/follows.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Exercise the real guard without Clerk network calls or credentials.
jest.mock('../src/auth/clerk.client', () => ({
  clerkClient: {
    authenticateRequest: jest.fn((incoming: Request) => {
      if (incoming.headers.get('authorization') === 'Bearer test-failure') {
        throw new Error('Authentication unavailable');
      }
      return Promise.resolve({
        isAuthenticated:
          incoming.headers.get('authorization') === 'Bearer test-viewer',
        toAuth: () => ({ userId: 'viewer' }),
      });
    }),
  },
}));

describe('Follow HTTP routes', () => {
  let app: INestApplication<App>;
  const users = [
    {
      id: 'viewer',
      username: 'viewer',
      firstName: 'View',
      lastName: 'Er',
      avatarUrl: null,
    },
    {
      id: 'target',
      username: 'target',
      firstName: 'Tar',
      lastName: 'Get',
      avatarUrl: null,
    },
  ];
  const follows = new Map<
    string,
    { followerId: string; followingId: string; createdAt: Date }
  >();
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(users.find((user) => user.id === where.id) ?? null),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    follow: {
      upsert: jest.fn(
        ({
          create,
        }: {
          create: { followerId: string; followingId: string };
        }) => {
          const key = `${create.followerId}:${create.followingId}`;
          const relation = follows.get(key) ?? {
            ...create,
            createdAt: new Date(),
          };
          follows.set(key, relation);
          return Promise.resolve(relation);
        },
      ),
      deleteMany: jest.fn(
        ({ where }: { where: { followerId: string; followingId: string } }) =>
          Promise.resolve({
            count: Number(
              follows.delete(`${where.followerId}:${where.followingId}`),
            ),
          }),
      ),
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            followerId_followingId: { followerId: string; followingId: string };
          };
        }) => {
          const key = where.followerId_followingId;
          return Promise.resolve(
            follows.get(`${key.followerId}:${key.followingId}`) ?? null,
          );
        },
      ),
      count: jest.fn(
        ({ where }: { where: { followerId?: string; followingId?: string } }) =>
          Promise.resolve(
            [...follows.values()].filter((relation) =>
              where.followerId
                ? relation.followerId === where.followerId
                : relation.followingId === where.followingId,
            ).length,
          ),
      ),
    },
    $transaction: jest.fn((queries: Promise<number>[]) => Promise.all(queries)),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FollowsController, UsersController],
      providers: [
        FollowsService,
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    follows.clear();
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['post', '/api/users/target/follow'],
    ['delete', '/api/users/target/follow'],
    ['get', '/api/users/target/follow-status'],
    ['get', '/api/users/target/followers'],
    ['get', '/api/users/target/following'],
    ['get', '/api/users/target'],
    ['get', '/api/me'],
  ] as const)('rejects unauthenticated %s %s', async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 401 when authentication throws', async () => {
    await request(app.getHttpServer())
      .get('/api/me')
      .auth('test-failure', { type: 'bearer' })
      .expect(401);
  });

  it('returns 201/204 repeatedly and updates profile counts and follow status', async () => {
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .post('/api/users/target/follow')
        .auth('test-viewer', { type: 'bearer' })
        .expect(201);
    }
    const target = await request(app.getHttpServer())
      .get('/api/users/target')
      .auth('test-viewer', { type: 'bearer' })
      .expect(200);
    expect(target.body).toMatchObject({
      id: 'target',
      followerCount: 1,
      followingCount: 0,
    });
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .auth('test-viewer', { type: 'bearer' })
      .expect(200);
    expect(me.body).toMatchObject({
      id: 'viewer',
      followerCount: 0,
      followingCount: 1,
    });
    await request(app.getHttpServer())
      .get('/api/users/target/follow-status')
      .auth('test-viewer', { type: 'bearer' })
      .expect(200, { isFollowing: true });
    for (let i = 0; i < 2; i++) {
      const response = await request(app.getHttpServer())
        .delete('/api/users/target/follow')
        .auth('test-viewer', { type: 'bearer' })
        .expect(204);
      expect(response.text).toBe('');
    }
    const after = await request(app.getHttpServer())
      .get('/api/users/target')
      .auth('test-viewer', { type: 'bearer' })
      .expect(200);
    expect(after.body).toMatchObject({ followerCount: 0, followingCount: 0 });
  });

  it.each(['followers', 'following'])(
    'serves the %s route with pagination',
    async (direction) => {
      await request(app.getHttpServer())
        .get(`/api/users/target/${direction}?limit=1`)
        .auth('test-viewer', { type: 'bearer' })
        .expect(200, { items: [], nextCursor: null });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 }),
      );
    },
  );

  it.each([
    'limit=0',
    'limit=101',
    'limit=1.5',
    'limit=abc',
    'limit=2&extra=x',
    'cursor=invalid',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/users/target/followers?${query}`)
      .auth('test-viewer', { type: 'bearer' })
      .expect(400);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('rejects self-follow with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/users/viewer/follow')
      .auth('test-viewer', { type: 'bearer' })
      .expect(400);
    expect(prisma.follow.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['post', '/api/users/missing/follow'],
    ['delete', '/api/users/missing/follow'],
    ['get', '/api/users/missing/follow-status'],
    ['get', '/api/users/missing/followers'],
    ['get', '/api/users/missing/following'],
    ['get', '/api/users/missing'],
  ] as const)('returns 404 for %s %s', async (method, path) => {
    await request(app.getHttpServer())
      [method](path)
      .auth('test-viewer', { type: 'bearer' })
      .expect(404);
  });
});
