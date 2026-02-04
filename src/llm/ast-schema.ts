import { z } from "zod";

export const EvidenceRefSchema = z.object({
  documento: z.string().min(1),
  pagina_folio: z.string().min(1),
  quote_id: z.string().nullable().optional(),
});

export const WarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  related_fichas: z.array(z.string()).optional(),
});

export const BlockSchema = z.object({
  kind: z.enum(["paragraph", "list"]),
  text: z.string().min(1),
  items: z.array(z.string().min(1)).optional(),
  supporting_fichas: z.array(z.string().min(1)).min(1),
  evidence_refs: z.array(EvidenceRefSchema),
});

export const SectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(BlockSchema),
});

export const RequestSchema = z.object({
  text: z.string().min(1),
  supporting_fichas: z.array(z.string().min(1)).min(1),
});

export const AnnexSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  supporting_fichas: z.array(z.string().min(1)).min(1),
  evidence_refs: z.array(EvidenceRefSchema),
});

export const DocumentAstSchema = z.object({
  meta: z.object({
    doc_type: z.literal("querella"),
    language: z.literal("es"),
    generated_at_iso: z.string().min(1),
  }),
  warnings: z.array(WarningSchema),
  sections: z.array(SectionSchema),
  requests: z.array(RequestSchema),
  annexes: z.array(AnnexSchema),
});

export type DocumentAst = z.infer<typeof DocumentAstSchema>;
