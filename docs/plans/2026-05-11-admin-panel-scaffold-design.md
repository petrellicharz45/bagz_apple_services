# Admin Panel Scaffold Design

## Goal
Scaffold a SvelteKit admin app at repo root under `admin/` using the official CLI
with the Skeleton template, TypeScript, ESLint, and Prettier enabled, and no
additional libraries.

## Scope
- Create `admin/` via `npm create svelte@latest admin` with the specified options.
- Install dependencies with `npm --prefix admin install`.
- Commit the scaffolded app.

## Approach Options
1. Interactive `npm create svelte@latest admin` (recommended). Matches task
   instructions and ensures exact selections.
2. Non-interactive flags. Faster but diverges from the explicit selection step.

## Architecture
- Standard SvelteKit Skeleton output, TypeScript enabled.
- ESLint and Prettier configured by the generator defaults.
- No additional configuration or code changes beyond the generator output.

## Verification
- Successful dependency install indicates scaffold health.
- No tests added or run for this task.

## Risks and Constraints
- Must avoid extra features or dependencies beyond the generator output.
