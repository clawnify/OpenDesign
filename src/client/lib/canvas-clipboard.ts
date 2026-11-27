import { ActiveSelection, FabricObject, IText, util, type Canvas } from "fabric";

const format = "application/x-opendesign-selection";

function ownsClipboard(event: Event, canvas: Canvas) {
  const target = event.target;
  const active = canvas.getActiveObject();
  if (target instanceof HTMLElement &&
      (target.isContentEditable || target.closest("input, textarea, select, dialog, [role=dialog]"))) return false;
  return !(active instanceof IText && active.isEditing);
}

export function listenToCanvasClipboard(
  getCanvas: () => Canvas | null,
  edit: (canvas: Canvas, change: () => void) => void,
) {
  // Keep the Fabric snapshot in this editor. The native clipboard marker lets
  // a later copy in another app supersede it without clipboard permissions.
  let snapshot: { id: string; object: ReturnType<FabricObject["toObject"]>; offset: number } | undefined;

  function capture(canvas: Canvas, cut: boolean, data?: DataTransfer) {
    const active = canvas.getActiveObject();
    if (!active || window.getSelection()?.toString()) return false;
    const id = crypto.randomUUID();
    const object = active.toObject();
    data?.setData(format, id);
    if (active instanceof IText) data?.setData("text/plain", active.text);
    snapshot = { id, object, offset: cut ? 0 : 12 };
    if (cut) {
      const selected = canvas.getActiveObjects();
      edit(canvas, () => {
        canvas.discardActiveObject();
        canvas.remove(...selected);
      });
    }
    return true;
  }

  async function paste(canvas: Canvas) {
    if (!snapshot) return;
    const { object, offset } = snapshot;
    snapshot.offset += 12;
    const [copy] = await util.enlivenObjects<FabricObject>([object]);
    if (canvas !== getCanvas()) {
      copy.dispose();
      return;
    }
    copy.set({ left: copy.left + offset, top: copy.top + offset });
    const layers = copy instanceof ActiveSelection ? copy.removeAll() : [copy];
    edit(canvas, () => {
      canvas.discardActiveObject();
      for (const layer of layers) layer.set("layerId", crypto.randomUUID());
      canvas.add(...layers);
      canvas.setActiveObject(layers.length === 1 ? layers[0] : new ActiveSelection(layers, { canvas }));
    });
  }

  function onClipboard(event: ClipboardEvent) {
    const canvas = getCanvas();
    const data = event.clipboardData;
    if (event.type !== "paste") snapshot = undefined;
    if (!canvas || !data || event.defaultPrevented || !ownsClipboard(event, canvas)) return;
    if (event.type === "paste") {
      if (!snapshot || data.getData(format) !== snapshot.id) return;
      event.preventDefault();
      void paste(canvas).catch(error => console.error("Failed to paste canvas selection", error));
    } else if (capture(canvas, event.type === "cut", data)) {
      event.preventDefault();
    }
  }

  // macOS sends native clipboard events for Command. Also support the
  // literal Control shortcuts when working with canvas objects on a Mac.
  function onControl(event: KeyboardEvent) {
    if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.defaultPrevented) return;
    const canvas = getCanvas();
    if (!canvas || !ownsClipboard(event, canvas)) return;
    const key = event.key.toLowerCase();
    if (key === "v" && snapshot) {
      event.preventDefault();
      void paste(canvas).catch(error => console.error("Failed to paste canvas selection", error));
    } else if (key === "x" || key === "c") {
      // Trigger the same native event so Control-copy also supports Command-paste.
      if (!canvas.getActiveObject() || window.getSelection()?.toString()) return;
      const cut = key === "x";
      if (document.execCommand(cut ? "cut" : "copy") || capture(canvas, cut)) event.preventDefault();
    }
  }

  window.addEventListener("cut", onClipboard);
  window.addEventListener("copy", onClipboard);
  window.addEventListener("paste", onClipboard);
  if (/Mac/.test(navigator.platform)) window.addEventListener("keydown", onControl);
  return () => {
    window.removeEventListener("cut", onClipboard);
    window.removeEventListener("copy", onClipboard);
    window.removeEventListener("paste", onClipboard);
    window.removeEventListener("keydown", onControl);
  };
}
