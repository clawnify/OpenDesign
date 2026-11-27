import type { Canvas } from "fabric";

const EDGE_SIZE = 48;
const MAX_SCROLL_PER_FRAME = 18;

function edgeSpeed(position: number, size: number) {
  const edge = Math.min(EDGE_SIZE, size / 2);
  const proximity = position < edge
    ? position / edge - 1
    : position > size - edge ? (position - size + edge) / edge : 0;
  return Math.sign(proximity) * Math.min(1, Math.abs(proximity)) ** 2 * MAX_SCROLL_PER_FRAME;
}

export function watchDragScroll(canvas: Canvas, scrollArea: HTMLElement) {
  let frame: number | null = null;
  let previousTime = 0;
  let pointer: MouseEvent | TouchEvent | null = null;
  let replaying = false;

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previousTime = 0;
    pointer = null;
    window.removeEventListener("blur", stop);
  }

  function scroll(time: number) {
    frame = null;
    if (!pointer) return;
    const point = "changedTouches" in pointer ? pointer.changedTouches[0] : pointer;
    if (!point) return;
    const rect = scrollArea.getBoundingClientRect();
    const { clientWidth, clientHeight, scrollLeft, scrollTop } = scrollArea;
    const step = previousTime ? Math.min((time - previousTime) / (1000 / 60), 2) : 1;
    scrollArea.scrollBy({
      left: Math.round(edgeSpeed(point.clientX - rect.left, clientWidth) * step),
      top: Math.round(edgeSpeed(point.clientY - rect.top, clientHeight) * step),
      behavior: "instant",
    });

    if (scrollArea.scrollLeft === scrollLeft && scrollArea.scrollTop === scrollTop) {
      previousTime = 0;
      return;
    }

    // Feed the same pointer position through Fabric after the surface moves.
    // The upper canvas keeps Fabric's pointer and canvas offsets in the same scroll container.
    replaying = true;
    canvas.upperCanvasEl.dispatchEvent(pointer);
    replaying = false;
    previousTime = time;
    frame = requestAnimationFrame(scroll);
  }

  const offMove = canvas.on("mouse:move", ({ e, transform }) => {
    if (replaying) return;
    if (transform?.action !== "drag" || ("buttons" in e && !(e.buttons & 1))) {
      stop();
      return;
    }
    if (!pointer) window.addEventListener("blur", stop);
    pointer = e;
    frame ??= requestAnimationFrame(scroll);
  });
  const offUp = canvas.on("mouse:up", stop);
  canvas.upperCanvasEl.addEventListener("touchcancel", stop);

  return () => {
    stop();
    offMove();
    offUp();
    canvas.upperCanvasEl.removeEventListener("touchcancel", stop);
  };
}
