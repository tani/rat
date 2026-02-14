const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createRendererFromExports(exportsLike) {
  const { memory, malloc, free, texstring, texfree } = exportsLike;
  if (!memory || !malloc || !free || !texstring || !texfree) {
    throw new Error("WASM module is missing one or more required exports");
  }
  return function render(latex) {
    const input = encoder.encode(String(latex) + "\0");
    const inputPtr = malloc(input.length);

    try {
      new Uint8Array(memory.buffer, inputPtr, input.length).set(input);
      const outputPtr = texstring(inputPtr);

      try {
        const mem = new Uint8Array(memory.buffer);
        let end = outputPtr;
        while (mem[end] !== 0) {
          end += 1;
        }
        return decoder.decode(mem.subarray(outputPtr, end));
      } finally {
        texfree(outputPtr);
      }
    } finally {
      free(inputPtr);
    }
  };
}
