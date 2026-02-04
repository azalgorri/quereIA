import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["log", "warn", "error"] });
  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
