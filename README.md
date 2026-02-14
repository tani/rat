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
