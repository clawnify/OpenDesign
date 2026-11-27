import { ActiveSelection, Point, type Canvas, type FabricObject } from "fabric";

// All artboards share the design's dimensions and CSS zoom. Their client
// rectangles include workspace pan and scrolling. Fabric's zoom includes DPR.
export function pageUnderObject(source: Canvas, object: FabricObject, pages: Map<string, Canvas>) {
  if (pages.size < 2) return;
  const rect = source.upperCanvasEl.getBoundingClientRect();
  const scale = rect.width * source.getZoom() / source.width;
  const center = object.getCenterPoint();
  const x = rect.left + center.x * scale;
  const y = rect.top + center.y * scale;
  const hit = document.elementFromPoint(x, y);
  const id = hit?.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
  const canvas = id && pages.get(id);
  if (!id || !canvas || canvas === source || hit !== canvas.upperCanvasEl) return;

  const destination = canvas.upperCanvasEl.getBoundingClientRect();
  const offset = new Point((rect.left - destination.left) / scale, (rect.top - destination.top) / scale);
  return { id, canvas, offset };
}

type Destination = NonNullable<ReturnType<typeof pageUnderObject>>;

export function moveToPage(source: Canvas, target: FabricObject, destination: Destination) {
  const objects = target instanceof ActiveSelection ? target.getObjects() : [target];
  // Discarding the selection restores each member's page-space transform.
  source.discardActiveObject();
  source.remove(...objects);
  for (const object of objects) object.setXY(object.getXY().add(destination.offset));
  destination.canvas.add(...objects);
  const selection = objects.length === 1 ? objects[0] : new ActiveSelection(objects, {canvas: destination.canvas});
  source.requestRenderAll();
  destination.canvas.requestRenderAll();
  return selection;
}

export function watchPagePreview(source: Canvas, pages: Map<string, Canvas>) {
  let preview: HTMLCanvasElement | undefined;
  const clear = () => { preview?.remove(); preview = undefined; };
  const offMove = source.on("object:moving", ({ target }) => {
    const destination = pageUnderObject(source, target, pages);
    if (!destination) { clear(); return; }
    if (!preview) {
      preview = target.toCanvasElement();
      preview.style.cssText = "position:absolute;pointer-events:none;transform:translate(-50%,-50%)";
      preview.setAttribute("aria-hidden", "true");
    }
    const { x, y } = target.getCenterPoint().add(destination.offset);
    preview.style.left = x + "px";
    preview.style.top = y + "px";
    const container = destination.canvas.upperCanvasEl.parentElement;
    if (container && preview.parentElement !== container) container.appendChild(preview);
  });
  const offUp = source.on("mouse:up", clear);
  source.upperCanvasEl.addEventListener("touchcancel", clear);
  window.addEventListener("blur", clear);
  return () => {
    clear();
    offMove();
    offUp();
    source.upperCanvasEl.removeEventListener("touchcancel", clear);
    window.removeEventListener("blur", clear);
  };
}
