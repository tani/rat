# mdd

`mdd` renders Markdown to plain text/Unicode output and provides a Vim/Neovim live preview plugin over JSON-RPC (stdio).

## Quick Start

Render Markdown from stdin:

```bash
echo "# Hello\n\n*world*" | ./mdd
```

Run JSON-RPC mode (used by the Vim plugin):

```bash
mdd --json-rpc
```

## Download

Download binaries from GitHub Releases (`nightly` tag):

```bash
mkdir -p ~/.local/bin
curl -fL https://github.com/tani/mdd/releases/download/nightly/mdd-darwin-arm64 -o ~/.local/bin/mdd
chmod +x ~/.local/bin/mdd
mdd --help
```

Linux x64 example:

```bash
mkdir -p ~/.local/bin
curl -fL https://github.com/tani/mdd/releases/download/nightly/mdd-linux-x64 -o ~/.local/bin/mdd
chmod +x ~/.local/bin/mdd
mdd --help
```

If `mdd` is not found, add this to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Vim/Neovim Plugin

```vim
Plug 'tani/mdd', { rtp: 'vim/' }
```

Commands:

- `:MddPreviewOpen`
- `:MddPreviewClose`
- `:MddPreviewToggle`

Behavior:

- Live preview updates without save (`TextChanged`, `TextChangedI`)
- Cursor sync from source buffer to preview (`CursorMoved`, `CursorMovedI`)

## Development Commands

```bash
bun test
bun run test:vim
bun run lint
bun run typecheck
bun run format:check
```
