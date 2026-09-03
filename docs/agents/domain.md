# Domain docs

How engineering skills should consume the domain documentation in this single-context repository.

## Read before exploring

- Read `docs/PRD.md` as the product requirements document and current ADR register. ADR-001 through ADR-009 are embedded in section 8.
- Read the relevant original documents under `docs/` when validating a requirement or tracing its source.
- Read `CONTEXT.md` at the repository root if it exists in the future.

The absence of `CONTEXT.md` is not a blocker and should not be reported as a prerequisite.

## Use established vocabulary

Use the domain terms established by `docs/PRD.md`, including Study Session, Character, Guild, Raid, Raid Contribution, Cosmetic Item, and persistent multi-device Session. Avoid introducing synonyms that obscure those concepts.

## Flag conflicts

If proposed work contradicts ADR-001 through ADR-009 in `docs/PRD.md`, state the conflict explicitly rather than silently overriding the decision.
