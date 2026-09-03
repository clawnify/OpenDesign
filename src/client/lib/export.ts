import type * as fabric from "fabric";

/** Every export renders at 2x the design size: crisp in a feed, still light enough to upload. */
export const EXPORT_SCALE = 2;

/**
 * Render one page to a PNG data URL at exactly EXPORT_SCALE x the design size.
 *
 * PageCanvas sizes each canvas backstore by the device pixel ratio, so fabric's
 * own `width` already carries that ratio and `getZoom()` is the very same factor.
 * `toDataURL` scales `width` by the multiplier, so a fixed multiplier makes the
 * export grow with whatever display the editor happens to be open on: 4320px on
 * a retina laptop, 2160px on an external 1x monitor, from the same design.
 * Dividing by the zoom cancels the ratio back out and pins the output size.
 *
 * Fabric sets `skipControlsDrawing` while exporting, so a selected object's
 * handles never reach the file and the user's selection can stay where it is.
 */
export function renderPageToPNG(canvas: fabric.Canvas, scale = EXPORT_SCALE): string {
  return canvas.toDataURL({ format: "png", multiplier: scale / canvas.getZoom(), quality: 1 });
}

export function downloadDataURL(dataURL: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataURL;
  link.click();
}

/** "Q3 Recap!" -> "q3-recap", so exports land under the design's own name. */
export function slugify(name: string, fallback = "design"): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/**
 * Assemble the pages into one PDF, the only format LinkedIn accepts for a
 * swipeable carousel since it retired native multi-image carousels in 2023.
 *
 * jsPDF swaps the page box to match `orientation`, so the orientation has to
 * agree with the format array or a landscape design comes out portrait. `px` is
 * CSS px, so the design's own dimensions become the page box and a 1080x1350
 * carousel keeps the 4:5 aspect LinkedIn recommends.
 *
 * Imported on demand: jsPDF is the single largest thing this app can load, and
 * only the export path ever needs it.
 */
export async function buildCarouselPDF(canvases: fabric.Canvas[], width: number, height: number) {
  const { jsPDF } = await import("jspdf");
  const orientation = width > height ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "px", format: [width, height], compress: true });

  canvases.forEach((canvas, i) => {
    if (i > 0) doc.addPage([width, height], orientation);
    doc.addImage(renderPageToPNG(canvas), "PNG", 0, 0, width, height);
  });

  return doc;
}

export async function exportPagesToPDF(
  canvases: fabric.Canvas[],
  width: number,
  height: number,
  filename: string,
) {
  const doc = await buildCarouselPDF(canvases, width, height);
  doc.save(filename);
}
