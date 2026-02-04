import { z } from "zod";

export const GenerateRequestSchema = z.object({
  selectedIds: z.array(z.string().min(1)).min(1),
  promptVersionId: z.string().min(1),
  options: z
    .object({
      mode: z.enum(["draft", "final"]).default("draft"),
      pseudonymize: z.boolean().default(false),
    })
    .default({ mode: "draft", pseudonymize: false }),
});

export type GenerateRequestDto = z.infer<typeof GenerateRequestSchema>;
