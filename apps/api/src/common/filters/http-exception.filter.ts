import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

const ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        message = 'A record with these details already exists';
        error = 'Conflict';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
        error = 'Not Found';
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      if (statusCode < HttpStatus.INTERNAL_SERVER_ERROR) {
        const body = exception.getResponse();

        if (typeof body === 'string') {
          message = body;
        } else if (Array.isArray(body.message)) {
          message = body.message.join('; ');
        } else if (typeof body.message === 'string') {
          message = body.message;
        }

        error =
          typeof body.error === 'string'
            ? body.error
            : (ERROR_NAMES[statusCode] ?? 'HTTP Error');
      } else {
        message = 'Internal server error';
        error = 'Internal Server Error';
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
