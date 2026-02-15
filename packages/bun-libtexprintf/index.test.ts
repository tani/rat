import { expect, test } from "bun:test";
import { getLibtexprintfRenderer } from "./index";

test("bun-libtexprintf: renders simple latex to unicode", async () => {
  const render = await getLibtexprintfRenderer();
  const output = render(String.raw`\\alpha + \\beta`);

  expect(output).toContain("alpha");
  expect(output).toContain("beta");
  expect(output).not.toContain("\\");
});
