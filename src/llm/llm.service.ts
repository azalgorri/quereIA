import { Injectable, InternalServerErrorException } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class LlmService {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async generateDocumentAst(params: {
    systemPrompt: string;
    projectPrompt: string;
    payload: unknown;
    model: string;
    temperature: number;
    maxOutputTokens: number;
  }) {
    try {
      const response = await this.client.responses.create({
        model: params.model,
        temperature: params.temperature,
        max_output_tokens: params.maxOutputTokens,
        input: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.projectPrompt },
          {
            role: "user",
            content: JSON.stringify({
              instruction: "Genera el DocumentAst con el schema acordado.",
              payload: params.payload,
            }),
          },
        ],
        response_format: { type: "json_object" },
      });

      const output = response.output_text?.trim();
      if (!output) {
        throw new InternalServerErrorException("LLM response was empty");
      }

      return JSON.parse(output);
    } catch (error) {
      throw new InternalServerErrorException("Failed to generate document AST");
    }
  }

  async repairDocumentAst(params: { invalidAst: unknown; issues: unknown }) {
    const response = await this.client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.2-codex",
      temperature: 0,
      max_output_tokens: 800,
      input: [
        {
          role: "system",
          content: "Corrige el JSON para que cumpla el schema DocumentAst. Responde solo JSON válido.",
        },
        {
          role: "user",
          content: JSON.stringify({ invalidAst: params.invalidAst, issues: params.issues }),
        },
      ],
      response_format: { type: "json_object" },
    });

    const output = response.output_text?.trim();
    if (!output) {
      throw new InternalServerErrorException("LLM repair response was empty");
    }

    return JSON.parse(output);
  }
}
