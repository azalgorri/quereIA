# Test Plan

## Unit tests
- Card validation: dependencies missing, conflicts active, evidences empty.
- Snapshot hashing: stable stringification produces consistent hash.
- AST schema validation: accepts valid AST, rejects missing supporting_fichas or malformed evidence.
- Evidence enforcement: blocks without evidence_refs are removed and warnings appended.
- RenderService: deterministic markdown output for known AST.

## Integration tests
- POST /api/generate with valid payload returns preview and versionId.
- Cache hit: same input returns cached=true and same versionId.
- Missing selectedIds returns 400.
- Invalid promptVersionId returns 404.

## Contract tests
- LLM output adheres to DocumentAst schema.
- Repair flow attempts only once and fails with 422 on invalid output.
