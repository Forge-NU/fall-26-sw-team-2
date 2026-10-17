import {
  CanActivate,
  ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';
import { clerkClient } from './clerk.client';

type OptionalAuthRequest = Request & { user?: { userId: string } };

// Like ClerkAuthGuard, but lets signed-out requests through: request.user is set
// only when a valid session token is sent. A missing or invalid token counts as
// signed out rather than a 401, so only use this where signed-out viewers are fine.
@Injectable()
export class OptionalClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OptionalAuthRequest>();

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

      if (requestState.isAuthenticated) {
        request.user = { userId: requestState.toAuth().userId };
      }
    } catch {
      // Treated as signed out
    }

    return true;
  }
}

// The signed-in user's id, or null when signed out. Use with OptionalClerkAuthGuard.
export const ViewerId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null =>
    context.switchToHttp().getRequest<OptionalAuthRequest>().user?.userId ??
    null,
);
