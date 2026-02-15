# rat

`rat` renders Markdown to plain text/Unicode output and provides a Vim/Neovim live preview plugin over JSON-RPC (stdio).

## Quick Start

Render Markdown from stdin:

```bash
echo "# Hello\n\n*world*" | ./rat
```

Render LaTeX from stdin:

```bash
echo 'Term: \(\alpha^2 + \beta\)' | rat --language=latex
```

Run JSON-RPC mode (used by the Vim plugin):

```bash
rat --json-rpc
```

## CLI Language Mode

`rat` supports language selection with:

- `--language=markdown`
- `--language=latex`

You can also use `--language markdown` / `--language latex`.
If omitted, default is `markdown`.

## JSON-RPC

`render` accepts `params.language`:

- `"markdown"` (default): returns `{ text, sourcemap, previewLine }`
- `"latex"`: returns `{ text, sourcemap, previewLine }`

This is a breaking change: `markdown` is no longer returned in JSON-RPC responses.

Example request:

```json
{"jsonrpc":"2.0","id":1,"method":"render","params":{"text":"A: $\\alpha+\\beta$","language":"latex"}}
```

Example response:

```json
{"jsonrpc":"2.0","id":1,"result":{"text":"A: α+β"}}
```

## Download

Download binaries from GitHub Releases (`nightly` tag):

```bash
mkdir -p ~/.local/bin
curl -fL https://github.com/tani/rat/releases/download/nightly/rat-darwin-arm64 -o ~/.local/bin/rat
chmod +x ~/.local/bin/rat
rat --help
```

Linux x64 example:

```bash
mkdir -p ~/.local/bin
curl -fL https://github.com/tani/rat/releases/download/nightly/rat-linux-x64 -o ~/.local/bin/rat
chmod +x ~/.local/bin/rat
rat --help
```

If `rat` is not found, add this to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Vim/Neovim Plugin

```vim
Plug 'tani/rat', { rtp: 'vim/' }
```

Commands:

- `:RatOpen`
- `:RatClose`
- `:RatToggle`

Behavior:

- Live preview updates without save (`TextChanged`, `TextChangedI`)
- Cursor sync from source buffer to preview (`CursorMoved`, `CursorMovedI`)
- Sends `params.language` automatically:
  - `latex` for `filetype` `tex`/`plaintex`/`latex`
  - `markdown` for all other filetypes

## Development Commands

```bash
bun test
bun run test:vim
bun run lint
bun run typecheck
bun run format:check
```
