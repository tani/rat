# mdd Vim Plugin

Minimal Vim plugin to sync current markdown buffer to a running `mdd` server.

## Install

Copy `vim/plugin/mdd.vim` into your Vim runtime path plugin directory.

## Behavior

- Sends asynchronous request on buffer enter/text change (default).
- Debounced sync to avoid flooding while typing.
- Optionally sends on cursor move (enabled by default).
- Uses `b=<base64(buffer)>` and `l=<current line>` to:
  - `http://127.0.0.1:8787/render`

## Commands

- `:MddSyncNow`
- `:MddSyncEnable`
- `:MddSyncDisable`

## Options

- `g:mdd_server_url` (default: `http://127.0.0.1:8787/render`)
- `g:mdd_sync_enabled` (default: `1`)
- `g:mdd_sync_on_cursor` (default: `1`)
- `g:mdd_sync_timeout_seconds` (default: `2`)
- `g:mdd_sync_async` (default: `1`)
- `g:mdd_sync_debounce_ms` (default: `100`)

## Requirements

- `curl`
