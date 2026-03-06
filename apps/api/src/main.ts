import { Logger } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RetryAfter429Filter } from './common/filters/retry-after.filter';
import { CorrelationIdMiddleware } from './common/http/correlation-id.middleware';
import { PinoHttpMiddleware } from './common/logging/pino-http.middleware';


async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const correlation = new CorrelationIdMiddleware();
  const pino = new PinoHttpMiddleware();
  app.use(correlation.use.bind(correlation));
  app.use(pino.use.bind(pino));

  app.useGlobalFilters(new RetryAfter429Filter());

  app.set('trust proxy', 1);
  app.use(cookieParser());

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3000;
  
  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );

}

bootstrap();
