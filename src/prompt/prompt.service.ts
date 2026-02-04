import { Injectable, NotFoundException } from "@nestjs/common";
import fs from "fs";
import path from "path";
import { PrismaService } from "../storage/prisma.service";

@Injectable()
export class PromptService {
  private readonly systemPrompt = fs.readFileSync(
    fs.existsSync(path.join(__dirname, "system-prompt-base.txt"))
      ? path.join(__dirname, "system-prompt-base.txt")
      : path.join(process.cwd(), "src", "prompt", "system-prompt-base.txt"),
    "utf8",
  );

  private readonly documentSkeleton = [
    "encabezado judicial",
    "comparecencia/representación",
    "exposición breve / objeto",
    "HECHOS",
    "FUNDAMENTOS",
    "SUPLICO",
    "OTROSÍ DIGO",
    "ANEXOS",
  ];

  constructor(private readonly prisma: PrismaService) {}

  getSystemPrompt() {
    return this.systemPrompt;
  }

  getDocumentSkeleton() {
    return this.documentSkeleton;
  }

  async getPromptVersion(id: string) {
    const prompt = await this.prisma.promptVersion.findUnique({ where: { id } });
    if (!prompt) {
      throw new NotFoundException("PromptVersion not found");
    }
    return prompt;
  }
}
