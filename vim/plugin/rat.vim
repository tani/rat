if exists('g:loaded_rat_plugin')
  finish
endif
let g:loaded_rat_plugin = 1

if &compatible
  set nocompatible
endif

let s:states = {}

function! s:get_rat_command() abort
  let l:path_rat = exepath('rat')
  if !empty(l:path_rat)
    return [l:path_rat, '--json-rpc']
  endif
  return []
endfunction

function! s:echoerr(msg) abort
  echohl ErrorMsg
  echom '[rat] ' . a:msg
  echohl None
endfunction

function! s:line_based_output(state, src_line) abort
  if !has_key(a:state, 'last_sourcemap')
    return a:src_line
  endif
  let l:segments = get(a:state.last_sourcemap, 'segments', [])
  for l:segment in l:segments
    let l:in_start = get(get(get(l:segment, 'input', {}), 'start', {}), 'line', 0)
    let l:in_end = get(get(get(l:segment, 'input', {}), 'end', {}), 'line', 0)
    if l:in_start <= a:src_line && a:src_line <= l:in_end
      return get(get(get(l:segment, 'output', {}), 'start', {}), 'line', a:src_line)
    endif
  endfor
  return a:src_line
endfunction

function! s:sync_preview_cursor(src_bufnr) abort
  let l:key = string(a:src_bufnr)
  if !has_key(s:states, l:key)
    return
  endif
  let l:state = s:states[l:key]
  let l:preview_win = get(l:state, 'preview_win', -1)
  if l:preview_win <= 0 || win_id2win(l:preview_win) == 0
    return
  endif
  let l:src_pos = getcurpos()
  let l:out_line = s:line_based_output(l:state, l:src_pos[1])
  call win_execute(l:preview_win, 'call cursor(' . l:out_line . ', 1) | normal! zz')
endfunction

function! s:replace_preview_buffer(preview_bufnr, markdown) abort
  let l:lines = split(a:markdown, "\n", 1)
  if empty(l:lines)
    let l:lines = ['']
  endif
  call setbufvar(a:preview_bufnr, '&readonly', 0)
  call setbufvar(a:preview_bufnr, '&modifiable', 1)
  if len(getbufline(a:preview_bufnr, 1, '$')) > 0
    call deletebufline(a:preview_bufnr, 1, '$')
  endif
  call setbufline(a:preview_bufnr, 1, l:lines)
  call setbufvar(a:preview_bufnr, '&modifiable', 0)
  call setbufvar(a:preview_bufnr, '&readonly', 1)
endfunction

function! s:handle_message(src_bufnr, msg) abort
  let l:key = string(a:src_bufnr)
  if !has_key(s:states, l:key)
    return
  endif
  if empty(a:msg)
    return
  endif

  try
    let l:parsed = json_decode(a:msg)
  catch
    return
  endtry

  if type(l:parsed) != v:t_dict
    return
  endif
  if !has_key(l:parsed, 'result')
    return
  endif
  if type(l:parsed.result) != v:t_dict
    return
  endif

  let l:state = s:states[l:key]
  let l:markdown = get(l:parsed.result, 'markdown', '')
  let l:state.last_sourcemap = get(l:parsed.result, 'sourcemap', {'version': 2, 'segments': []})
  call s:replace_preview_buffer(l:state.preview_bufnr, l:markdown)
  let s:states[l:key] = l:state

  if bufnr('%') == a:src_bufnr
    call s:sync_preview_cursor(a:src_bufnr)
  endif
endfunction

function! s:queue_send(src_bufnr) abort
  let l:key = string(a:src_bufnr)
  if !has_key(s:states, l:key)
    return
  endif
  let l:state = s:states[l:key]
  if get(l:state, 'sending', 0)
    return
  endif
  let l:state.sending = 1
  let s:states[l:key] = l:state
  call timer_start(120, {-> s:send_render(a:src_bufnr)})
endfunction

function! s:send_render(src_bufnr) abort
  let l:key = string(a:src_bufnr)
  if !has_key(s:states, l:key)
    return
  endif
  let l:state = s:states[l:key]
  let l:state.sending = 0
  if !bufexists(a:src_bufnr)
    return
  endif

  let l:line = line('.')
  let l:col = col('.')
  if bufnr('%') != a:src_bufnr
    let l:line = get(getbufinfo(a:src_bufnr)[0], 'lnum', 1)
    let l:col = 1
  endif

  let l:state.request_id += 1
  let l:text = join(getbufline(a:src_bufnr, 1, '$'), "\n")
  let l:req = {
        \ 'jsonrpc': '2.0',
        \ 'id': l:state.request_id,
        \ 'method': 'render',
        \ 'params': {
        \   'text': l:text,
        \   'cursor': {'line': l:line, 'column': l:col},
        \ },
        \ }

  if has('nvim')
    call chansend(l:state.job, json_encode(l:req) . "\n")
  else
    call ch_sendraw(l:state.job, json_encode(l:req) . "\n")
  endif

  let s:states[l:key] = l:state
endfunction

function! s:close_preview(src_bufnr) abort
  let l:key = string(a:src_bufnr)
  if !has_key(s:states, l:key)
    return
  endif
  let l:state = s:states[l:key]

  if has('nvim')
    if get(l:state, 'job', 0) > 0
      call chanclose(l:state.job, 'stdin')
      call jobstop(l:state.job)
    endif
  else
    if get(l:state, 'job', 0) > 0
      call job_stop(l:state.job)
    endif
  endif

  if get(l:state, 'preview_win', -1) > 0 && win_id2win(l:state.preview_win) != 0
    call win_execute(l:state.preview_win, 'close')
  endif

  call remove(s:states, l:key)
endfunction

function! s:maybe_refresh_for_current_buffer() abort
  let l:src_bufnr = bufnr('%')
  let l:key = string(l:src_bufnr)
  if !has_key(s:states, l:key)
    return
  endif
  call s:queue_send(l:src_bufnr)
endfunction

function! s:maybe_cursor_sync_for_current_buffer() abort
  let l:src_bufnr = bufnr('%')
  let l:key = string(l:src_bufnr)
  if !has_key(s:states, l:key)
    return
  endif
  call s:sync_preview_cursor(l:src_bufnr)
endfunction

function! s:on_vim_stdout(src_bufnr, channel, msg) abort
  call s:handle_message(a:src_bufnr, a:msg)
endfunction

function! s:on_nvim_stdout(src_bufnr, job, lines, event) abort
  for l:line in a:lines
    if !empty(l:line)
      call s:handle_message(a:src_bufnr, l:line)
    endif
  endfor
endfunction

function! s:open() abort
  let l:src_bufnr = bufnr('%')
  let l:key = string(l:src_bufnr)
  if has_key(s:states, l:key)
    call s:queue_send(l:src_bufnr)
    return
  endif

  let l:cmd = s:get_rat_command()
  if len(l:cmd) == 0 || !executable(l:cmd[0])
    call s:echoerr('missing executable in PATH: rat')
    return
  endif

  vertical rightbelow new
  let l:preview_win = win_getid()
  enew
  let l:preview_bufnr = bufnr('%')
  setlocal buftype=nofile bufhidden=wipe nobuflisted noswapfile nowrap
  setlocal filetype=markdown
  setlocal nonumber norelativenumber
  setlocal nomodifiable readonly

  wincmd p

  let l:state = {
        \ 'job': 0,
        \ 'preview_win': l:preview_win,
        \ 'preview_bufnr': l:preview_bufnr,
        \ 'request_id': 0,
        \ 'sending': 0,
        \ 'last_sourcemap': {'version': 2, 'segments': []},
        \ }

  if has('nvim')
    let l:job = jobstart(l:cmd, {
          \ 'on_stdout': function('s:on_nvim_stdout', [l:src_bufnr]),
          \ 'stdout_buffered': v:false,
          \ })
    if l:job <= 0
      call s:echoerr('failed to start rat json-rpc process')
      execute l:preview_win . 'wincmd c'
      return
    endif
    let l:state.job = l:job
  else
    let l:job = job_start(l:cmd, {
          \ 'mode': 'nl',
          \ 'out_cb': function('s:on_vim_stdout', [l:src_bufnr]),
          \ })
    if job_status(l:job) ==# 'fail'
      call s:echoerr('failed to start rat json-rpc process')
      execute l:preview_win . 'wincmd c'
      return
    endif
    let l:state.job = l:job
  endif

  let s:states[l:key] = l:state
  call s:queue_send(l:src_bufnr)
endfunction

function! s:close() abort
  call s:close_preview(bufnr('%'))
endfunction

function! s:toggle() abort
  let l:key = string(bufnr('%'))
  if has_key(s:states, l:key)
    call s:close()
  else
    call s:open()
  endif
endfunction

augroup rat_events
  autocmd!
  autocmd TextChanged,TextChangedI * call s:maybe_refresh_for_current_buffer()
  autocmd CursorMoved,CursorMovedI * call s:maybe_cursor_sync_for_current_buffer()
  autocmd BufWipeout * call s:close_preview(str2nr(expand('<abuf>')))
augroup END

command! RatPreviewOpen call <SID>open()
command! RatPreviewClose call <SID>close()
command! RatPreviewToggle call <SID>toggle()
