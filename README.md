# rat

<img width="1802" height="1111" alt="image" src="https://github.com/user-attachments/assets/c9589cb4-8107-4b62-a1e1-8b8f4109f95f" />

It’s not a cat, not a bat, but rat: your terminal’s new best friend.
`rat` stands for **Render All Text** (at least, that is one way to read it): a lightweight CLI that turns Markdown and LaTeX into terminal-friendly Unicode text, with a Vim/Neovim plugin for live JSON-RPC rendering.

For best Unicode glyph rendering in terminals and editors, JuliaMono is recommended.

## Features

- Markdown to Unicode/plain-text output
- LaTeX to Unicode/plain-text output
- Works with files or stdin
- JSON-RPC mode for editor integrations
- Vim/Neovim live preview plugin included

## Install

### Option 1: Download a prebuilt binary

macOS (Apple Silicon):

```bash
mkdir -p ~/.local/bin
curl -fL https://github.com/tani/rat/releases/download/nightly/rat-darwin-arm64 -o ~/.local/bin/rat
chmod +x ~/.local/bin/rat
```

Linux x64:

```bash
mkdir -p ~/.local/bin
curl -fL https://github.com/tani/rat/releases/download/nightly/rat-linux-x64 -o ~/.local/bin/rat
chmod +x ~/.local/bin/rat
```

If needed, add this to your shell profile:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Verify:

```bash
rat --help
```

### Option 2: Build from source

Requirements: `bun`

```bash
git clone https://github.com/tani/rat.git
cd rat
bun install
bun run compile
```

## Quick Start

Render Markdown from stdin:

```bash
echo "# Hello\n\n*world*" | rat
```

Render Markdown from a file:

```bash
rat examples/EXAMPLE.md
```

Render LaTeX from stdin:

```bash
echo 'Term: \(\alpha^2 + \beta\)' | rat --language=latex
```

Render LaTeX from a file:

```bash
rat --language=latex examples/EXAMPLE.tex
```

Language options:

- `--language=markdown` (default)
- `--language=latex`
- Also accepted: `--language markdown` / `--language latex`
- Backward compatibility: `--latex`

## Vim/Neovim Plugin

Install with `vim-plug`:

```vim
Plug 'tani/rat', { 'rtp': 'vim/' }
```

Commands:

- `:RatOpen`
- `:RatClose`
- `:RatToggle`

Behavior:

- Live preview updates on edit and cursor move (`TextChanged`, `TextChangedI`, `CursorMoved`, `CursorMovedI`)
- Cursor sync to preview (`CursorMoved`, `CursorMovedI`)
- Sends JSON-RPC `params.language` automatically:
  - `latex` for `tex`, `plaintex`, `latex`
  - `markdown` for everything else

## JSON-RPC

Start server mode:

```bash
rat --json-rpc
```

Supported methods:

- `render` with `params: { text, cursor?, language? }`
- `shutdown`

Example request:

```json
{"jsonrpc":"2.0","id":1,"method":"render","params":{"text":"A: $\\alpha+\\beta$","language":"latex"}}
```

Example response:

```json
{"jsonrpc":"2.0","id":1,"result":{"text":"A: α+β","cursorMapping":{"sourceLine":1,"sourceColumn":1,"renderedLine":1,"renderedColumn":1,"strategy":"line-anchor","confidence":1}}}
```

`previewLine` and `sourcemap` were removed in favor of `cursorMapping`.

## Unicode Sourcemap API

`@rat/unicode-sourcemap` now exposes a mapper object API:

```ts
import { createUnicodeSourcemap } from "@rat/unicode-sourcemap";

const mapper = createUnicodeSourcemap(source, target);
const result = mapper.mapCursor({ line: 10, column: 5 });
```

## Development

```bash
bun test
bun run test:vim
bun run lint
bun run typecheck
bun run format:check
```

## License

MIT. See `LICENSE`.
