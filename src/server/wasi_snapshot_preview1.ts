// Minimal WASI preview1 shim used by static wasm module import.
// This runtime path does not rely on WASI host stdio features.

export function proc_exit(code: number): never {
  throw new Error(`WASM requested proc_exit(${code})`);
}

export function fd_close(_fd: number): number {
  return 0;
}

export function fd_write(
  _fd: number,
  _iovs: number,
  _iovsLen: number,
  _nwritten: number,
): number {
  return 0;
}

export function fd_seek(
  _fd: number,
  _offsetLow: number,
  _offsetHigh: number,
  _whence: number,
  _newOffset: number,
): number {
  return 0;
}
