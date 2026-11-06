# API Conventions

This document describes the shared patterns and conventions used across all API endpoints to ensure consistency and maintainability.

## Error Response Shape

All error responses follow a consistent shape regardless of the error type (400, 401, 404, 409, 500).

### Error Response Format

```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found",
  "path": "/api/users/123",
  "timestamp": "2026-10-16T19:00:00.000Z"
}
```

### Fields

- `statusCode`: HTTP status code (number)
- `message`: Human-readable error message (string)
- `error`: Error type name (string)
- `path`: Request path (string)
- `timestamp`: ISO 8601 timestamp (string)

### Prisma Error Mapping

Prisma errors are mapped centrally in the global exception filter:

- `P2002` (unique constraint violation) → 409 Conflict
- `P2025` (record not found) → 404 Not Found

Do not handle these errors in individual services. Let them propagate to the global filter.

### Implementation

The global exception filter is registered in `main.ts`:

```typescript
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

app.useGlobalFilters(new HttpExceptionFilter());
```

## Cursor-Based Pagination

All list endpoints use cursor-based pagination for efficient data retrieval.

### Request Parameters

Use the `PaginationDto` class:

```typescript
import { PaginationDto } from '../common/decorators/pagination.dto';

@Get('users')
async listUsers(@Query() pagination: PaginationDto) {
  // pagination.cursor?: string - base64-encoded cursor
  // pagination.limit?: number - defaults to 20, max 100
}
```

### Response Shape

Use the `PaginatedResponse<T>` type from `shared-types`:

```typescript
import { PaginatedResponse } from 'shared-types';

{
  "items": [...],
  "nextCursor": "dXNlcl80NTY=" // null if no more results
}
```

### Implementation

In your service:

```typescript
import { decodeCursor, buildPaginatedResponse } from '../common/utils/pagination.helper';

async listUsers(pagination: PaginationDto) {
  const { cursor, limit = 20 } = pagination;

  const where = cursor
    ? { id: { gt: decodeCursor(cursor) } }
    : {};

  const users = await this.prisma.user.findMany({
    where,
    take: limit + 1, // Fetch one extra to determine if there's a next page
    orderBy: { id: 'asc' },
  });

  const hasMore = users.length > limit;
  const items = hasMore ? users.slice(0, -1) : users;

  return buildPaginatedResponse(items, hasMore, (user) => user.id);
}
```

## Shared Types Package

The `shared-types` package contains TypeScript types that are shared between the API and mobile app to ensure type safety across the contract boundary.

### Location

`apps/shared-types/src/`: users, pagination, errors and uploads in `index.ts`; trips and posts in `content.ts`; `locations.ts`, `stories.ts` and `follows.ts`. Everything is exported from `index.ts`. This is the only copy of the contract: don't redeclare response types in `apps/api` or `apps/mobile`.

### Adding New Types

Add types to the file for their area, or a new file, and re-export them from `index.ts`:

```typescript
// apps/shared-types/src/index.ts
export type { StoryResponse, CreateStoryRequest } from './stories.js';
```

Relative imports inside the package need the `.js` extension. The API resolves `shared-types` with `nodenext`, which can't find `./stories` and silently turns its types into `any` (`skipLibCheck` hides the error).

### Building

After adding or modifying types, rebuild the package:

```bash
cd apps/shared-types
npm run build
```

### Using in API

Use `import type`, so the API never loads the package at runtime:

```typescript
import type { UserResponse } from 'shared-types';

@Get('me')
async getMe(): Promise<UserResponse> {
  // ...
}
```

### Using in Mobile App

```typescript
import type { UserResponse } from 'shared-types';
```

The mobile app's `tsconfig.json` is configured to resolve `shared-types` to the source directory for development. Type changes in `shared-types` will cause type errors in both apps where they are misused.

## Authentication

### @CurrentUser Decorator

Use the `@CurrentUser()` decorator to access the authenticated user ID in your controllers:

```typescript
import { CurrentUser } from '../auth/current-user.decorator';

@Get('me')
@UseGuards(ClerkAuthGuard)
async getMe(@CurrentUser() userId: string) {
  // userId is the Clerk user ID from the authenticated session
}
```

This replaces the manual cast to `AuthedRequest`.

### Global API Prefix

All routes are prefixed with `/api` globally in `main.ts`:

```typescript
app.setGlobalPrefix('api');
```

Do not add `@Controller('api')` to your controllers. Just use the resource name:

```typescript
@Controller()
export class UsersController {
  @Get('me') // Maps to /api/me
  async getMe() { }
}
```

## Workspace Setup

The project uses npm workspaces to manage the monorepo structure with three packages:

- `apps/api` - NestJS backend
- `apps/mobile` - Expo React Native app
- `apps/shared-types` - Shared TypeScript types

### Dependencies

Both apps reference `shared-types` as a workspace dependency:

```json
// apps/api/package.json
{
  "dependencies": {
    "shared-types": "*"
  }
}

// apps/mobile/package.json
{
  "dependencies": {
    "shared-types": "*"
  }
}
```

This ensures npm links the packages correctly during development.

## Adding a New Endpoint

### 1. Define Types in shared-types

Add the request/response types to `apps/shared-types/src/index.ts`:

```typescript
export interface CreatePostDto {
  content: string;
  imageUrl?: string;
}

export interface PostResponse {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  author: UserSummary;
}
```

### 2. Create DTO (if needed)

For validation, create a DTO in your controller's dto folder:

```typescript
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreatePostDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
```

### 3. Add Service Method

```typescript
async createPost(userId: string, data: CreatePostDto) {
  return this.prisma.post.create({
    data: {
      userId,
      ...data,
    },
  });
}
```

### 4. Create Response Mapper (if needed)

For complex response types, create a mapper function in your service's utils folder:

```typescript
// posts/utils/post.mapper.ts
import { PostResponse } from 'shared-types';

export function mapPostToResponse(post: {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl: string | null;
  };
}): PostResponse {
  return {
    id: post.id,
    content: post.content,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt.toISOString(),
    author: {
      id: post.user.id,
      firstName: post.user.firstName,
      lastName: post.user.lastName,
      username: post.user.username,
      avatarUrl: post.user.avatarUrl,
    },
  };
}
```

### 5. Add Controller Endpoint

```typescript
import type { PostResponse } from 'shared-types';
import { mapPostToResponse } from './utils/post.mapper';

@Post('posts')
@UseGuards(ClerkAuthGuard)
async createPost(
  @CurrentUser() userId: string,
  @Body() dto: CreatePostDto,
): Promise<PostResponse> {
  const post = await this.postsService.createPost(userId, dto);

  return mapPostToResponse(post);
}
```

### 5. Add Tests

Write unit tests for the service and controller:

```typescript
describe('PostsController', () => {
  it('creates a post', async () => {
    mockPostsService.createPost.mockResolvedValue(mockPost);

    await expect(controller.createPost('user_123', dto)).resolves.toEqual(expectedResponse);
  });
});
```

## Example: GET /api/users

This endpoint demonstrates all the conventions together:

- Uses `@CurrentUser()` for auth
- Uses `PaginationDto` for pagination
- Returns `PaginatedResponse<UserSummary>` using shared types
- Uses response mapper to avoid duplication
- Relies on global exception filter for error handling
- Uses global `/api` prefix

```typescript
@Get('users')
@UseGuards(ClerkAuthGuard)
async listUsers(
  @CurrentUser() userId: string,
  @Query() pagination: PaginationDto,
): Promise<PaginatedResponse<UserSummary>> {
  const result = await this.usersService.listUsers(pagination);

  return {
    items: result.items.map(mapUserToResponse),
    nextCursor: result.nextCursor,
  };
}
```

## Summary Checklist

When adding a new endpoint:

- [ ] Add types to `shared-types`
- [ ] Create DTO with validation decorators
- [ ] Implement service method
- [ ] Create response mapper (if response is complex/repeated)
- [ ] Use `@CurrentUser()` for authenticated endpoints
- [ ] Use `PaginationDto` for list endpoints
- [ ] Return typed responses from `shared-types`
- [ ] Don't handle Prisma errors (let the global filter handle them)
- [ ] Add unit tests
- [ ] Rebuild `shared-types` if types changed
