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

`apps/shared-types/src/index.ts`

### Adding New Types

Add types to `apps/shared-types/src/index.ts`:

```typescript
export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
```

### Building

After adding or modifying types, rebuild the package:

```bash
cd apps/shared-types
npm run build
```

### Using in API

```typescript
import { UserResponse, PaginatedResponse } from 'shared-types';

@Get('me')
async getMe(): Promise<UserResponse> {
  // ...
}
```

### Using in Mobile App

```typescript
import { UserResponse } from 'shared-types';

export type { UserResponse };
```

The mobile app's `tsconfig.json` is configured to resolve `shared-types` to the source directory for development.

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
  author: UserResponse;
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

### 4. Add Controller Endpoint

```typescript
import { UserResponse, PostResponse } from 'shared-types';

@Post('posts')
@UseGuards(ClerkAuthGuard)
async createPost(
  @CurrentUser() userId: string,
  @Body() dto: CreatePostDto,
): Promise<PostResponse> {
  const post = await this.postsService.createPost(userId, dto);

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
- Returns `PaginatedResponse<UserResponse>` using shared types
- Relies on global exception filter for error handling
- Uses global `/api` prefix

```typescript
@Get('users')
@UseGuards(ClerkAuthGuard)
async listUsers(
  @CurrentUser() userId: string,
  @Query() pagination: PaginationDto,
): Promise<PaginatedResponse<UserResponse>> {
  const result = await this.usersService.listUsers(pagination);

  return {
    items: result.items.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatarUrl: user.avatarUrl,
    })),
    nextCursor: result.nextCursor,
  };
}
```

## Summary Checklist

When adding a new endpoint:

- [ ] Add types to `shared-types`
- [ ] Create DTO with validation decorators
- [ ] Implement service method
- [ ] Use `@CurrentUser()` for authenticated endpoints
- [ ] Use `PaginationDto` for list endpoints
- [ ] Return typed responses from `shared-types`
- [ ] Don't handle Prisma errors (let the global filter handle them)
- [ ] Add unit tests
- [ ] Rebuild `shared-types` if types changed
