declare module "libtexprintf" {
  export interface LibtexprintfRenderResult {
    output: string;
    errors: string[];
  }

  export interface LibtexprintfRenderer {
    (latex: string): LibtexprintfRenderResult;
    setFontstyle?: (name: string) => void;
  }

  export function createRender(
    instance: WebAssembly.Instance,
    options?: {
      onError?: (errors: string[]) => void;
      throwOnError?: boolean;
    },
  ): LibtexprintfRenderer;

  export function loadInstance(): Promise<WebAssembly.Instance>;
}

declare module "libtexprintf/libtexprintf.wasm" {
  const wasmPath: string;
  export default wasmPath;
}
