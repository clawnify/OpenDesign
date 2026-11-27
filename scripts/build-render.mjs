import { build } from "esbuild";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const { outputFiles } = await build({
  entryPoints: ["src/client/render-page.ts"],
  outfile: "render.js",
  bundle: true,
  minify: true,
  write: false,
  external: ["jspdf"],
  loader: { ".woff": "dataurl", ".woff2": "dataurl" },
});
const script = outputFiles.find((file) => file.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const scriptHash = createHash("sha256").update(script).digest("base64");
const css = outputFiles.find((file) => file.path.endsWith(".css")).text;
// A render payload only needs the families used by that page. Chrome supports WOFF2.
const fontCss = {};
for (const [rule] of css.matchAll(/@font-face\{[^}]+\}/g)) {
  const family = rule.match(/font-family:([^;}]+)/)?.[1].trim().replace(/^["']|["']$/g, "");
  if (!family) throw new Error("Render font stylesheet is missing a family.");
  const woff2 = rule.replace(/,url\(data:font\/woff;base64,[^)]*\) format\([^)]*\)/g, "");
  fontCss[family] = (fontCss[family] || "") + woff2;
}
if (!fontCss.Inter) throw new Error("Render font stylesheet is empty.");
await writeFile("src/server/render-bundle.generated.ts",
  `export const script = ${JSON.stringify(script)};\nexport const scriptHash = ${JSON.stringify(scriptHash)};\nexport const fontCss: Record<string, string> = ${JSON.stringify(fontCss)};\n`);
