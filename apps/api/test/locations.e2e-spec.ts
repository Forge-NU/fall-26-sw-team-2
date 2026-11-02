import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser } from './utils/test-app';

describe('Locations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let user: User;
  let mapboxId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    user = await createTestUser(prisma, 'locator');
    mapboxId = `test.${user.id}`;
  });

  afterAll(async () => {
    await prisma.location.deleteMany({ where: { providerPlaceId: mapboxId } });
    await prisma.user.delete({ where: { id: user.id } });
    await app.close();
  });

  const as = (u: User) => ({ 'x-test-user': u.id });
  const mapboxPlace = () => ({
    kind: 'mapbox',
    mapboxId,
    name: 'Pastéis de Belém',
    latitude: 38.697464,
    longitude: -9.203213,
  });

  it('rejects an unauthenticated resolve with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/locations/resolve')
      .send(mapboxPlace())
      .expect(401);
  });

  it('resolves a Mapbox place to the same row every time', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/locations/resolve')
      .set(as(user))
      .send(mapboxPlace())
      .expect(200);
    expect(first.body).toMatchObject({
      kind: 'mapbox',
      location: {
        provider: 'mapbox',
        providerPlaceId: mapboxId,
        name: 'Pastéis de Belém',
        latitude: 38.697464,
      },
    });

    const second = await request(app.getHttpServer())
      .post('/api/locations/resolve')
      .set(as(user))
      .send(mapboxPlace())
      .expect(200);
    const idOf = (res: request.Response) =>
      (res.body as { location: { id: string } }).location.id;
    expect(idOf(second)).toBe(idOf(first));
  });

  it('resolves a custom location without storing a row', async () => {
    await request(app.getHttpServer())
      .post('/api/locations/resolve')
      .set(as(user))
      .send({ kind: 'custom', name: "Tia Rosa's kitchen" })
      .expect(200, { kind: 'custom', name: "Tia Rosa's kitchen" });
  });

  it('rejects an invalid body with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/locations/resolve')
      .set(as(user))
      .send({ kind: 'google', name: 'x' })
      .expect(400);
  });

  // #87: the controller once hardcoded 'api/locations' on top of the global prefix
  it('is not served under the doubled /api/api prefix', async () => {
    await request(app.getHttpServer())
      .post('/api/api/locations/resolve')
      .set(as(user))
      .send(mapboxPlace())
      .expect(404);
  });
});
