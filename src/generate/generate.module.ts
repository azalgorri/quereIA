import { Module } from "@nestjs/common";
import { GenerateController } from "./generate.controller";
import { GenerateService } from "./generate.service";
import { LlmService } from "../llm/llm.service";
import { RenderService } from "../render/render.service";
import { PromptService } from "../prompt/prompt.service";
import { SecurityService } from "../security/security.service";
import { PrismaService } from "../storage/prisma.service";

@Module({
  controllers: [GenerateController],
  providers: [GenerateService, LlmService, RenderService, PromptService, SecurityService, PrismaService],
})
export class GenerateModule {}
