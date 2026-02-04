import { Module } from "@nestjs/common";
import { GenerateModule } from "../generate/generate.module";
import { PrismaService } from "../storage/prisma.service";

@Module({
  imports: [GenerateModule],
  providers: [PrismaService],
})
export class AppModule {}
