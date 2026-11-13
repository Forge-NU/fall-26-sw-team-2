import './load-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');

  // The Expo web build (npm start, then w) runs on another origin. The mobile
  // app doesn't need CORS, so in production it's only on for the origins
  // CORS_ORIGIN_PATTERN matches (staging allows the EAS Hosting web previews).
  const corsOriginPattern = process.env.CORS_ORIGIN_PATTERN;
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors();
  } else if (corsOriginPattern) {
    app.enableCors({ origin: new RegExp(corsOriginPattern) });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
