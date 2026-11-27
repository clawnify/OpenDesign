import { useEditor } from "../context";
import { useState } from "preact/hooks";
import { X, SlidersHorizontal, Shapes } from "lucide-preact";
import { readCanvas } from "../../shared/canvas-merge";
import { CanvasArea } from "./canvas-area";
import { Toolbar } from "./toolbar";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { PagesBar } from "./pages-bar";

export function Editor() {
  const {editors, conflict, resolveConflict, pages, selectedObject} = useEditor();
  const [mobilePanel, setMobilePanel] = useState<"tools" | "properties" | null>(null);
  function layerLabel(selection: string | null) {
    if (!selection) return "";
    const [pageId, layerId] = selection.split(":");
    const page = pages.find(p => p.id === pageId);
    if (!page) return "";
    if (!layerId) return page.title;
    const object = readCanvas(page.canvas_json).objects.find(o => o.layerId === layerId);
    return object ? String(object.fieldName || object.text || object.type || "layer").slice(0, 48) : "layer";
  }
  return (
    <div class="flex flex-col h-full w-full">
      <Toolbar />
      {editors.length > 0 && <div class="sr-only" aria-live="polite">{editors.map(editor =>
        <span key={editor.id}>{editor.name}{editor.selection ? " · " + layerLabel(editor.selection) : " · In this design"}</span>)}</div>}
      {conflict && <div class="flex items-center gap-2 px-3 py-2 text-label" role="alert">
        {conflict.removed ? <span>{conflict.page.title} was deleted while you had edits.</span> : <span>Overlapping edits on {conflict.page.title}: {conflict.layers.map(id => layerLabel(conflict.page.id + ":" + id) || id).join(", ") || "page changed"}.</span>}
        {conflict.layers.map(id => {
          const mine = readCanvas(conflict.local).objects.find(o => o.layerId === id)?.text;
          const saved = readCanvas(conflict.page.canvas_json).objects.find(o => o.layerId === id)?.text;
          return typeof mine === "string" && typeof saved === "string" && mine !== saved ? <span key={id}>Your text: {mine} · Saved text: {saved}</span> : null;
        })}
        <button class="btn btn-secondary" onClick={() => resolveConflict("mine")}>{conflict.removed ? "Recover as a new page" : "Keep my conflicting edits"}</button>
        <button class="btn btn-secondary" onClick={() => resolveConflict("theirs")}>{conflict.removed ? "Discard local page" : "Use saved edits"}</button>
      </div>}
      <div class="editor-workspace flex flex-1 min-h-0">
        <div class={`editor-side editor-tools ${mobilePanel === "tools" ? "is-open" : ""}`}>
          <button class="editor-panel-close" aria-label="Close tools" onClick={() => setMobilePanel(null)}><X size={20} /></button>
          <LeftSidebar />
        </div>
        <div class="flex-1 flex flex-col min-w-0">
          <CanvasArea />
          <PagesBar />
        </div>
        <div class={`editor-side editor-properties ${mobilePanel === "properties" ? "is-open" : ""}`}>
          <button class="editor-panel-close" aria-label="Close properties" onClick={() => setMobilePanel(null)}><X size={20} /></button>
          <RightSidebar />
        </div>
      </div>
      <nav class="editor-mobile-controls" aria-label="Editor panels">
        <button class="btn btn-secondary" aria-expanded={mobilePanel === "tools"} onClick={() => setMobilePanel(mobilePanel === "tools" ? null : "tools")}><Shapes size={18} /> Tools</button>
        <button class="btn btn-secondary" aria-expanded={mobilePanel === "properties"} onClick={() => setMobilePanel(mobilePanel === "properties" ? null : "properties")}><SlidersHorizontal size={18} /> {selectedObject ? "Edit selection" : "Canvas settings"}</button>
      </nav>
    </div>
  );
}
