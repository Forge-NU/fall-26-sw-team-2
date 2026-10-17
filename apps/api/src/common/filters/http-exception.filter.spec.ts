import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { Prisma } from '../../generated/prisma/client';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  const createMockHost = (url: string, jsonCallback: (data: any) => void) => ({
    switchToHttp: () => ({
      getRequest: () => ({ url, originalUrl: url }),
      getResponse: () => ({
        status: (code: number) => ({
          json: (data: any) => {
            jsonCallback(data);
          },
        }),
      }),
    }),
  }) as ArgumentsHost;

  it('should handle Prisma P2002 (unique constraint) as 409 Conflict', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.10.0' },
    );

    filter.catch(prismaError, createMockHost('/api/me', (data) => {
      expect(data.statusCode).toBe(409);
      expect(data.error).toBe('Conflict');
      expect(data.message).toBe('A record with these details already exists');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('timestamp');
    }));
  });

  it('should handle Prisma P2025 (record not found) as 404 Not Found', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      { code: 'P2025', clientVersion: '7.10.0' },
    );

    filter.catch(prismaError, createMockHost('/api/users/123', (data) => {
      expect(data.statusCode).toBe(404);
      expect(data.error).toBe('Not Found');
      expect(data.message).toBe('Resource not found');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('timestamp');
    }));
  });

  it('should handle HttpException with message array', () => {
    const exception = new HttpException(
      {
        message: ['username must be longer than or equal to 3 characters'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, createMockHost('/api/me', (data) => {
      expect(data.statusCode).toBe(400);
      expect(data.error).toBe('Bad Request');
      expect(data.message).toBe('username must be longer than or equal to 3 characters');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('timestamp');
    }));
  });

  it('should handle HttpException with string message', () => {
    const exception = new HttpException(
      'User not found',
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, createMockHost('/api/users/123', (data) => {
      expect(data.statusCode).toBe(404);
      expect(data.error).toBe('Not Found');
      expect(data.message).toBe('User not found');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('timestamp');
    }));
  });

  it('should include all required fields in error response', () => {
    const exception = new HttpException(
      {
        message: 'User not found',
        error: 'Not Found',
      },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, createMockHost('/api/users/123', (data) => {
      const requiredFields = ['statusCode', 'message', 'error', 'path', 'timestamp'];
      requiredFields.forEach(field => {
        expect(data).toHaveProperty(field);
      });
    }));
  });

  it('should return consistent error shape across different error types', () => {
    const checkShape = (data: any) => {
      expect(data).toHaveProperty('statusCode');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.statusCode).toBe('number');
      expect(typeof data.message).toBe('string');
      expect(typeof data.error).toBe('string');
      expect(typeof data.path).toBe('string');
      expect(typeof data.timestamp).toBe('string');
    };

    // Test 400
    const badRequest = new HttpException(
      { message: 'Bad input', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(badRequest, createMockHost('/api/me', checkShape));

    // Test 404
    const notFound = new HttpException(
      { message: 'Not found', error: 'Not Found' },
      HttpStatus.NOT_FOUND,
    );
    filter.catch(notFound, createMockHost('/api/users/123', checkShape));

    // Test 409 (Prisma)
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.10.0' },
    );
    filter.catch(conflict, createMockHost('/api/me', checkShape));
  });
});
