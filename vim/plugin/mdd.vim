if exists('g:loaded_mdd_plugin')
  finish
endif
let g:loaded_mdd_plugin = 1

if !exists('g:mdd_server_url')
  let g:mdd_server_url = 'http://127.0.0.1:8787/render'
endif
if !exists('g:mdd_sync_enabled')
  let g:mdd_sync_enabled = 1
endif
if !exists('g:mdd_sync_on_cursor')
  let g:mdd_sync_on_cursor = 1
endif
if !exists('g:mdd_sync_timeout_seconds')
  let g:mdd_sync_timeout_seconds = 2
endif
if !exists('g:mdd_sync_async')
  let g:mdd_sync_async = 1
endif
if !exists('g:mdd_sync_debounce_ms')
  let g:mdd_sync_debounce_ms = 100
endif

function! s:TargetBuffer() abort
  if &buftype !=# ''
    return 0
  endif
  return &filetype ==# 'markdown' || expand('%:e') =~# '^\%(md\|markdown\|mdx\)$'
endfunction

function! s:BuildRequest(line_num) abort
  let l:url = get(g:, 'mdd_server_url', 'http://127.0.0.1:8787/render')
  let l:timeout = max([1, float2nr(get(g:, 'mdd_sync_timeout_seconds', 2))])
  let l:base = 'curl -sS -o /dev/null --max-time ' . l:timeout
        \ . ' --get ' . shellescape(l:url)
        \ . ' --data-urlencode ' . shellescape('l=' . a:line_num)
  let l:tmp = tempname()
  call writefile(getline(1, '$'), l:tmp)
  return 'b64=$(base64 < ' . shellescape(l:tmp) . " | tr -d '\\n'); "
        \ . l:base
        \ . ' --data-urlencode "b=${b64}"'
        \ . '; rm -f ' . shellescape(l:tmp)
endfunction

function! s:Dispatch(cmd) abort
  if get(g:, 'mdd_sync_async', 1) && exists('*jobstart')
    call jobstart(['sh', '-c', a:cmd], {'detach': v:true})
  else
    call system(a:cmd)
  endif
endfunction

function! s:SyncNow() abort
  if !get(g:, 'mdd_sync_enabled', 1) || !s:TargetBuffer()
    return
  endif
  if !executable('curl') || !executable('base64')
    return
  endif

  call s:Dispatch(s:BuildRequest(line('.')))
endfunction

function! s:QueueSync() abort
  if !get(g:, 'mdd_sync_enabled', 1) || !s:TargetBuffer()
    return
  endif

  if exists('b:mdd_sync_timer')
    call timer_stop(b:mdd_sync_timer)
  endif
  let b:mdd_sync_timer = timer_start(
        \ max([0, float2nr(get(g:, 'mdd_sync_debounce_ms', 100))]),
        \ {-> <SID>SyncNow()})
endfunction

command! MddSyncNow call <SID>SyncNow()
command! MddSyncEnable let g:mdd_sync_enabled = 1 | call <SID>QueueSync()
command! MddSyncDisable let g:mdd_sync_enabled = 0

augroup mdd_sync
  autocmd!
  autocmd BufEnter,TextChanged,TextChangedI *.md,*.markdown,*.mdx call <SID>QueueSync()
  autocmd CursorMoved *.md,*.markdown,*.mdx if get(g:, 'mdd_sync_on_cursor', 1) | call <SID>QueueSync() | endif
augroup END
