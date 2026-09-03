import { EditorContext } from "./context";
import { useCanvasState } from "./hooks/use-canvas";
import { useDesigns } from "./hooks/use-designs";
import { useRouter } from "./hooks/use-router";
import { Editor } from "./components/editor";
import { Home } from "./components/home";
import WebFont from "webfontloader";
import { useEffect, useRef } from "preact/hooks";

export function App() {
  const { path, navigate, designId } = useRouter();
  const canvasState = useCanvasState();
  const designState = useDesigns(canvasState.getCanvasJSONForPage, canvasState.getCanvasSize);

  // Load Google Fonts
  useEffect(() => {
    WebFont.load({
      google: {
        families: [
          "Inter:400,500,600,700",
          "Playfair Display:400,500,600,700,800,900",
          "Montserrat:400,500,600,700,800,900",
          "Poppins:400,500,600,700",
          "Roboto:400,500,700",
          "Open Sans:400,600,700",
          "Lora:400,700",
          "Raleway:400,500,600",
          "Source Sans Pro:400,600,700",
          "Merriweather:400,700",
        ],
      },
    });
  }, []);

  // Load design from URL on initial load and when designId changes
  useEffect(() => {
    if (designId && !designState.loading) {
      if (designState.activeDesign?.id !== designId) {
        designState.loadDesign(designId);
      }
    }
  }, [designId, designState.loading]);

  // Adopt a design's own frame when it is opened. Keyed on the design id, not
  // the object: saving replaces activeDesign, and re-running then would snap
  // the canvas back to the stored size mid-edit, undoing a resize.
  const framedDesignIdRef = useRef<string | null>(null);
  useEffect(() => {
    const design = designState.activeDesign;
    if (!design || framedDesignIdRef.current === design.id) return;
    framedDesignIdRef.current = design.id;
    if (design.width && design.height) {
      canvasState.setCanvasSize(design.width, design.height, { reflow: false });
    }
  }, [designState.activeDesign]);

  // Auto-activate first page when pages load and canvases are registered
  useEffect(() => {
    if (designState.pages.length > 0 && !canvasState.activeCanvasId) {
      canvasState.setActiveCanvas(designState.pages[0].id);
    }
  }, [designState.pages, canvasState.activeCanvasId]);

  if (designState.loading) {
    return (
      <div class="flex items-center justify-center h-full bg-[#F3F4F7]">
        <div class="text-center">
          <div class="spinner !w-6 !h-6 !border-accent/30 !border-t-accent mb-3 mx-auto" />
          <p class="text-zinc-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Home / gallery view
  if (!designId) {
    return (
      <Home
        designs={designState.designs}
        templates={designState.templates}
        navigate={navigate}
        createDesign={designState.createDesign}
        deleteDesign={designState.deleteDesign}
        renameDesign={designState.renameDesign}
        createFromTemplate={designState.createFromTemplate}
      />
    );
  }

  // Editor view
  const contextValue = {
    ...canvasState,
    ...designState,
    // activeCanvasId is the source of truth for which page is active
    activePageId: canvasState.activeCanvasId ?? designState.activePageId,
    navigate,
  };

  return (
    <EditorContext.Provider value={contextValue}>
      <Editor />
    </EditorContext.Provider>
  );
}
