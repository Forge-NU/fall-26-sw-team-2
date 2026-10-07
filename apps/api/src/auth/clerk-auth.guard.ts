import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { clerkClient } from './clerk.client';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      const requestState = await clerkClient.authenticateRequest(
        new globalThis.Request(
          `${request.protocol}://${request.get('host')}${request.originalUrl}`,
          {
            method: request.method,
            headers: request.headers as HeadersInit,
          },
        ),
      );

      if (!requestState.isAuthenticated) {
        throw new UnauthorizedException();
      }

      const { userId } = requestState.toAuth();

      (request as Request & { user: { userId: string } }).user = { userId };

      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
