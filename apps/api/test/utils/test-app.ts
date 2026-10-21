import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { AppModule } from '../../src/app.module';
import { ClerkAuthGuard } from '../../src/auth/clerk-auth.guard';
import { PrismaService } from '../../src/prisma/prisma.service';
import { StorageService } from '../../src/storage/storage.service';

// E2E tests run against the local Postgres (docker compose up -d, then
// npx prisma migrate deploy). Clerk is replaced by an `x-test-user` header,
// and S3 by a mock so tests can check which objects get deleted.

export const storageMock = {
  getReadUrl: jest.fn((key: string) =>
    Promise.resolve(`https://s3.test/${key}`),
  ),
  deleteObjects: jest.fn(() => Promise.resolve()),
};

const fakeAuthGuard = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.header('x-test-user');
    if (!userId) throw new UnauthorizedException();
    (request as Request & { user: { userId: string } }).user = { userId };
    return true;
  },
};

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ClerkAuthGuard)
    .useValue(fakeAuthGuard)
    .overrideProvider(StorageService)
    .useValue(storageMock)
    .compile();

  const app: INestApplication = moduleRef.createNestApplication();
  // Same pipe as main.ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

// Creates a user with a unique ID. Deleting it at the end of a test file
// cascades to everything it owns.
export async function createTestUser(prisma: PrismaService, name: string) {
  const suffix = randomUUID().slice(0, 8);
  return prisma.user.create({
    data: {
      id: `user_test_${name}_${suffix}`,
      email: `${name}_${suffix}@example.com`,
      firstName: name,
      lastName: 'Test',
      username: `test_${name}_${suffix}`,
    },
  });
}

export function isoDate(offsetDays = 0) {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + offsetDays,
    ),
  )
    .toISOString()
    .slice(0, 10);
}
