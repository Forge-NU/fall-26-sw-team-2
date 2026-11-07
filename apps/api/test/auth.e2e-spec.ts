import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Uses the real ClerkAuthGuard; only Clerk's network call is replaced, and it
// never authenticates, so every request must be rejected before reaching a
// controller.
jest.mock('../src/auth/clerk.client', () => ({
  clerkClient: {
    authenticateRequest: jest.fn((incoming: Request) => {
      if (incoming.headers.get('authorization') === 'Bearer throws') {
        throw new Error('Clerk unavailable');
      }
      return Promise.resolve({ isAuthenticated: false });
    }),
  },
}));

const id = '00000000-0000-0000-0000-000000000000';

// Every route except GET /api and the Clerk webhook. Add new routes here.
const protectedRoutes = [
  ['get', '/api/me'],
  ['post', '/api/me/profile'],
  ['patch', '/api/me'],
  ['delete', '/api/me'],
  ['get', '/api/me/trips/active'],
  ['get', '/api/users'],
  ['get', '/api/users/username-availability?username=someone'],
  ['get', '/api/users/someone'],
  ['get', '/api/users/id/user_1'],
  ['get', '/api/users/user_1/trips'],
  ['get', '/api/users/user_1/followers'],
  ['get', '/api/users/user_1/following'],
  ['get', '/api/users/user_1/follow-status'],
  ['post', '/api/users/user_1/follow'],
  ['delete', '/api/users/user_1/follow'],
  ['post', '/api/trips'],
  ['get', `/api/trips/${id}`],
  ['patch', `/api/trips/${id}`],
  ['delete', `/api/trips/${id}`],
  ['post', `/api/trips/${id}/publish`],
  ['get', `/api/trips/${id}/posts`],
  ['post', '/api/posts'],
  ['get', `/api/posts/${id}`],
  ['patch', `/api/posts/${id}`],
  ['delete', `/api/posts/${id}`],
] as const;

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(protectedRoutes)('%s %s', (method, path) => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())[method](path).expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await request(app.getHttpServer())
        [method](path)
        .auth('not-a-real-token', { type: 'bearer' })
        .expect(401);
    });
  });

  it('returns 401 when Clerk verification throws', async () => {
    await request(app.getHttpServer())
      .get('/api/me')
      .auth('throws', { type: 'bearer' })
      .expect(401);
  });

  it('leaves the webhook public (it checks its own signature)', async () => {
    process.env['CLERK_WEBHOOK_SIGNING_SECRET'] = 'whsec_dGVzdA==';
    await request(app.getHttpServer())
      .post('/api/webhooks/clerk')
      .send({})
      .expect(400);
  });
});
