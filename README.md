# rat

`rat` renders Markdown to plain text/Unicode output and provides a Vim/Neovim live preview plugin over JSON-RPC (stdio).

## Quick Start

Render Markdown from stdin:

```bash
echo "# Hello\n\n*world*" | ./rat
```

Run JSON-RPC mode (used by the Vim plugin):

```bash
rat --json-rpc
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

## Development Commands

```bash
bun test
bun run test:vim
bun run lint
bun run typecheck
bun run format:check
```
