import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { GenerateRequestDto, GenerateRequestSchema } from "./dto/generate-request.dto";
import { GenerateService } from "./generate.service";

@Controller("generate")
export class GenerateController {
  constructor(private readonly generateService: GenerateService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(GenerateRequestSchema))
  async generate(@Body() body: GenerateRequestDto) {
    return this.generateService.generate(body);
  }
}
