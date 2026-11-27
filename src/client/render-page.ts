import { StaticCanvas } from "fabric";
import { loadCustomFont, loadFonts } from "./fonts";
import { renderPageToPNG } from "./lib/export";
import { fitAll } from "./lib/fit-text";
import type { CustomFont } from "./types";

interface RenderInput {
  canvas: Record<string, unknown>;
  fonts: CustomFont[];
  width: number;
  height: number;
  scale: number;
}

async function render() {
  const source = document.getElementById("design-input");
  if (!source?.textContent) throw new Error("Missing canvas.");
  const input: RenderInput = JSON.parse(source.textContent);
  await Promise.all([loadFonts(), ...input.fonts.map(loadCustomFont)]);
  const canvas = new StaticCanvas(document.createElement("canvas"), {
    width: input.width,
    height: input.height,
    enableRetinaScaling: false,
  });

  try {
    await canvas.loadFromJSON(input.canvas);
    fitAll(canvas);
    canvas.renderAll();
    const image = new Image();
    image.src = renderPageToPNG(canvas, input.scale);
    await image.decode();
    image.id = "rendered-page";
    document.body.appendChild(image);
  } finally {
    await canvas.dispose();
  }
}

void render().catch((error: unknown) => console.error("Could not render the design.", error));
