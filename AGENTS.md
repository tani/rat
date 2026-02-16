# AGENTS.md

This document provides instructions and context for AI agents working on the `rat` (Render All Text) project.

## Project Overview

`rat` is a lightweight CLI and library that transforms Markdown and LaTeX into terminal-friendly Unicode text. It is designed for terminal users who want rich document rendering without leaving the command line.

- **Main Repository:** `tani/rat`
- **Primary Language:** TypeScript
- **Runtime:** Bun
- **Key Technologies:** `unified`, `remark`, `arktype`, `Unicode`

## Technical Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Formatter:** `oxfmt`
- **Linter:** `eslint`
- **Type Checker:** `tsc`
- **Monorepo Management:** Bun Workspaces

## Development Workflow

AI agents MUST follow these steps after completing every task:

1. **Format Code:** Run `bun run format` to ensure consistent code style using `oxfmt`.
2. **Lint Code:** Run `bun run lint` to catch potential issues.
3. **Type Check:** Run `bun run typecheck` to ensure type safety.
4. **Run Tests:** Run `bun test` to verify that no regressions were introduced.

```bash
bun run format && bun run lint && bun run typecheck && bun test
```

## Architecture

The project is structured as a monorepo under `packages/`:

- `packages/cli`: The main entry point for the `rat` command.
- `packages/markdown-unicode`: Core logic for Markdown transformations.
- `packages/latex-unicode`: Core logic for LaTeX transformations.
- `packages/unicode-sourcemap`: Mapping utilities for editor integrations (e.g., Vim/Neovim plugin).
- `packages/remark-unicode-*`: Specialized `remark` plugins for various Markdown extensions (math, tables, mermaid, etc.).

## Guidelines for Agents

- **Prefer Functional Programming:** Use pure functions and immutable data structures where possible.
- **Type Safety:** Use Arktype for runtime validation where appropriate.
- **Minimal Dependencies:** Keep the dependency tree lean.
- **Unicode Support:** Always consider how glyphs will be rendered in common terminal emulators (e.g., handle wide characters, combining marks).
- **Vim Integration:** Be mindful of the JSON-RPC interface in `packages/cli` as it powers the Vim/Neovim live preview.

## Known Constraints & Tips

- Always check `.githooks` for any additional pre-commit logic.
- When working with LaTeX, ensure compatibility with common engines (though `rat` primarily targets Unicode output).
