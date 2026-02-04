import { Injectable } from "@nestjs/common";
import { DocumentAst } from "../llm/ast-schema";

@Injectable()
export class RenderService {
  renderMarkdown(ast: DocumentAst) {
    const lines: string[] = [];

    lines.push(`# QUERELLA`);

    ast.sections.forEach((section) => {
      lines.push(`\n## ${section.title}`);
      section.blocks.forEach((block) => {
        if (block.kind === "paragraph") {
          lines.push(block.text);
        } else {
          if (block.text) {
            lines.push(block.text);
          }
          block.items?.forEach((item) => lines.push(`- ${item}`));
        }
        lines.push(this.renderEvidence(block.supporting_fichas, block.evidence_refs));
      });
    });

    if (ast.requests.length > 0) {
      lines.push("\n## PETICIONES");
      ast.requests.forEach((req) => {
        lines.push(`- ${req.text}`);
        lines.push(this.renderSupporting(req.supporting_fichas));
      });
    }

    if (ast.annexes.length > 0) {
      lines.push("\n## ANEXOS");
      ast.annexes.forEach((annex) => {
        lines.push(`- ${annex.label}: ${annex.description}`);
        lines.push(this.renderEvidence(annex.supporting_fichas, annex.evidence_refs));
      });
    }

    if (ast.warnings.length > 0) {
      lines.push("\n## WARNINGS");
      ast.warnings.forEach((warning) => {
        lines.push(`- [${warning.code}] ${warning.message}`);
      });
    }

    return lines.join("\n");
  }

  private renderEvidence(supporting: string[], refs: Array<{ documento: string; pagina_folio: string; quote_id?: string | null }>) {
    const evidence = refs
      .map((ref) => `(${ref.documento}, ${ref.pagina_folio}${ref.quote_id ? `, ${ref.quote_id}` : ""})`)
      .join("; ");
    return `Referencias: ${evidence} | Fichas: ${supporting.join(", ")}`;
  }

  private renderSupporting(supporting: string[]) {
    return `Fichas: ${supporting.join(", ")}`;
  }
}
