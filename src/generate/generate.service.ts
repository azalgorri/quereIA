import { BadRequestException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../storage/prisma.service";
import { GenerateRequestDto } from "./dto/generate-request.dto";
import { PromptService } from "../prompt/prompt.service";
import { LlmService } from "../llm/llm.service";
import { DocumentAst, DocumentAstSchema } from "../llm/ast-schema";
import { RenderService } from "../render/render.service";
import { SecurityService } from "../security/security.service";
import crypto from "crypto";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.2-codex";
const TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE ?? 0.1);
const MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 2000);

@Injectable()
export class GenerateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptService: PromptService,
    private readonly llmService: LlmService,
    private readonly renderService: RenderService,
    private readonly securityService: SecurityService,
  ) {}

  async generate(request: GenerateRequestDto) {
    const cards = await this.prisma.card.findMany({
      where: { id: { in: request.selectedIds } },
      include: { evidencias: true },
    });

    if (cards.length !== request.selectedIds.length) {
      throw new BadRequestException("Some selectedIds were not found");
    }

    const promptVersion = await this.promptService.getPromptVersion(request.promptVersionId);

    const preWarnings = this.validateCards(cards);

    const snapshot = {
      selectedIds: request.selectedIds,
      cards,
      promptVersionId: promptVersion.id,
      model: MODEL,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    };

    const snapshotHash = this.hashSnapshot(snapshot);

    const cached = await this.prisma.documentVersion.findFirst({
      where: {
        snapshotHash,
        promptVersionId: promptVersion.id,
        model: MODEL,
        mode: request.options.mode,
      },
    });

    if (cached) {
      return {
        versionId: cached.id,
        preview: cached.renderedPreview,
        warnings: cached.warnings,
        cached: true,
      };
    }

    const { payloadCards, pseudonymMap } = request.options.pseudonymize
      ? this.securityService.pseudonymizeCards(cards)
      : { payloadCards: cards, pseudonymMap: null };

    const llmPayload = {
      cards: payloadCards.map((card) => ({
        id: card.id,
        titulo: card.titulo,
        tipo: card.tipo,
        estado: card.estado,
        hecho: card.hecho,
        impacto: card.impacto,
        peticion: card.peticion,
        tags: card.tags,
        prioridad: card.prioridad,
        dependencias: card.dependencias,
        conflictos: card.conflictos,
        evidencias: card.evidencias.map((ev) => ({
          documento: ev.documento,
          pagina_folio: ev.paginaFolio,
          cita_literal: ev.citaLiteral,
          quote_id: ev.quoteId,
        })),
      })),
      document_skeleton: this.promptService.getDocumentSkeleton(),
      mode: request.options.mode,
    };

    const ast = await this.llmService.generateDocumentAst({
      systemPrompt: this.promptService.getSystemPrompt(),
      projectPrompt: promptVersion.content,
      payload: llmPayload,
      model: MODEL,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    const validatedAst = await this.validateAstWithRepair(ast);
    const { sanitizedAst, warnings: astWarnings } = this.enforceEvidenceRefs(validatedAst);

    const renderedPreview = this.renderService.renderMarkdown(sanitizedAst);

    const warnings = [...preWarnings, ...sanitizedAst.warnings, ...astWarnings];

    const documentVersion = await this.prisma.documentVersion.create({
      data: {
        promptVersionId: promptVersion.id,
        model: MODEL,
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        snapshotHash,
        snapshotJson: snapshot,
        astJson: sanitizedAst,
        renderedPreview,
        warnings,
        mode: request.options.mode,
      },
    });

    if (pseudonymMap) {
      await this.prisma.pseudonymMap.create({
        data: {
          documentVersionId: documentVersion.id,
          encryptedMap: this.securityService.encryptMap(pseudonymMap),
        },
      });
    }

    return {
      versionId: documentVersion.id,
      preview: renderedPreview,
      warnings,
      cached: false,
    };
  }

  private validateCards(cards: Array<{ id: string; dependencias: string[]; conflictos: string[]; evidencias: unknown[] }>) {
    const warnings: Array<{ code: string; message: string; related_fichas?: string[] }> = [];
    const cardIds = new Set(cards.map((card) => card.id));

    cards.forEach((card) => {
      const missingDependencies = card.dependencias.filter((dep) => !cardIds.has(dep));
      if (missingDependencies.length > 0) {
        warnings.push({
          code: "DEPENDENCY_MISSING",
          message: `La ficha ${card.id} requiere dependencias ausentes: ${missingDependencies.join(", ")}.`,
          related_fichas: [card.id, ...missingDependencies],
        });
      }

      const activeConflicts = card.conflictos.filter((conflict) => cardIds.has(conflict));
      if (activeConflicts.length > 0) {
        warnings.push({
          code: "CONFLICT_ACTIVE",
          message: `La ficha ${card.id} tiene conflictos activos: ${activeConflicts.join(", ")}.`,
          related_fichas: [card.id, ...activeConflicts],
        });
      }

      if (card.evidencias.length === 0) {
        warnings.push({
          code: "EVIDENCE_MISSING",
          message: `La ficha ${card.id} no tiene evidencias suficientes.`,
          related_fichas: [card.id],
        });
      }
    });

    if (warnings.length > 0) {
      // Keep deterministic warnings; do not block generation.
    }

    return warnings;
  }

  private hashSnapshot(snapshot: unknown) {
    const stable = this.stableStringify(snapshot);
    return crypto.createHash("sha256").update(stable).digest("hex");
  }

  private stableStringify(value: unknown) {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      return `{${entries.map(([key, val]) => `"${key}":${this.stableStringify(val)}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private async validateAstWithRepair(ast: unknown): Promise<DocumentAst> {
    const result = DocumentAstSchema.safeParse(ast);
    if (result.success) {
      return result.data;
    }

    const repair = await this.llmService.repairDocumentAst({
      invalidAst: ast,
      issues: result.error.issues,
    });

    const repairedResult = DocumentAstSchema.safeParse(repair);
    if (!repairedResult.success) {
      throw new UnprocessableEntityException({
        message: "LLM output did not match schema",
        issues: repairedResult.error.issues,
      });
    }

    return repairedResult.data;
  }

  private enforceEvidenceRefs(ast: DocumentAst) {
    const warnings: Array<{ code: string; message: string; related_fichas?: string[] }> = [];

    const sanitizedSections = ast.sections.map((section) => {
      const filteredBlocks = section.blocks.filter((block) => {
        if (block.evidence_refs.length === 0) {
          warnings.push({
            code: "BLOCK_EVIDENCE_MISSING",
            message: `Bloque sin evidence_refs en sección ${section.key}.`,
            related_fichas: block.supporting_fichas,
          });
          return false;
        }
        return true;
      });
      return { ...section, blocks: filteredBlocks };
    });

    return { sanitizedAst: { ...ast, sections: sanitizedSections }, warnings };
  }
}
