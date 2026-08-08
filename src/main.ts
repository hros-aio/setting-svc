import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createCorsOptions, setupSwagger, setupVersioning } from '@new-hros/libs-apis';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable CORS using @new-hros/libs-apis
  app.enableCors(createCorsOptions());

  // Enable API Versioning using @new-hros/libs-apis
  setupVersioning(app, { defaultVersion: '1' });

  // Global Route Prefix - strictly setting-api (FR-001)
  const globalPrefix = 'setting-api';
  app.setGlobalPrefix(globalPrefix);

  // Validation pipe configuration
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable graceful shutdown hooks for SIGTERM / SIGINT (FR-006, T016)
  app.enableShutdownHooks();

  // Swagger Documentation Setup using @new-hros/libs-apis
  setupSwagger(app, {
    title: 'Setting Service API',
    description: 'Enterprise HRMS Setting Service REST APIs',
    version: '1.0.0',
    path: `${globalPrefix}/docs`,
    tags: ['Health'],
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
}

bootstrap();
