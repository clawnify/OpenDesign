import { EditorContext } from "./context";
import { useCanvasState } from "./hooks/use-canvas";
import { useDesigns } from "./hooks/use-designs";
import { useBrandKits } from "./hooks/use-brand-kits";
import { useRouter } from "./hooks/use-router";
import { Editor } from "./components/editor";
import { Home } from "./components/home";
import { useFonts } from "./fonts";
import { AppNav, reportLocation, previewDocument, useDocumentCollaboration, useHostChanges } from "@clawnify/app/client";
import { DragPreviews } from "./lib/drag-previews";
import { useEffect, useMemo, useRef } from "preact/hooks";

export function App() {
  const { path, navigate, designId } = useRouter();
  const saveSchedulerRef = useRef<(immediate?: boolean) => void>(() => {});
  const dragPreviews = useMemo(() => new DragPreviews(value => {
    if (designId) previewDocument(designId, value);
  }), [designId]);
  useEffect(() => () => dragPreviews.dispose(), [dragPreviews]);
  const canvasState = useCanvasState(immediate => saveSchedulerRef.current(immediate));
  const designState = useDesigns(canvasState.getCanvasJSONForPage, canvasState.getCanvasSize, canvasState.applyRemoteMove);
  saveSchedulerRef.current = designState.scheduleSave;
  const layer = (canvasState.selectedObject as {layerId?: string} | null)?.layerId;
  const selection = canvasState.activeCanvasId && layer ? canvasState.activeCanvasId + ":" + layer : null;
  const openDocument = designId && designState.loadedDesignId === designId ? designId : null;
  const editors = useDocumentCollaboration(openDocument, selection, designState.refresh, dragPreviews.receive);
  useHostChanges(() => { if (openDocument) designState.refresh(); });
  useEffect(() => {
    if (!openDocument) return;
    const interval = setInterval(() => {if (!document.hidden) designState.refresh();}, 60000);
    return () => clearInterval(interval);
  }, [openDocument, designState.refresh]);
  const brandState = useBrandKits();
  const fontState = useFonts();

  // In the Clawnify dashboard the open screen lives in the host URL, so a
  // reload comes back to the same design.
  useEffect(() => {
    reportLocation(path);
  }, [path]);

  // Load design from URL on initial load and when designId changes
  useEffect(() => {
    if (designId && !designState.loading && designState.loadedDesignId !== designId) {
      designState.loadDesign(designId);
    }
  }, [designId, designState.loading, designState.loadedDesignId]);

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

  // Inside Clawnify the dashboard draws this navigation. Anywhere else the app
  // keeps its own layout (standalone draws nothing) and AppNav only adds the
  // SDK's notice for a self-hosted copy.
  const hostNav = (
    <AppNav
      title="Design"
      icon="image"
      active={designId ?? "home"}
      groups={[
        { items: [{ id: "home", label: "Designs", icon: "layout-grid", href: "/", home: true }] },
        {
          label: "Recent designs",
          items: designState.designs.map((d) => ({ id: d.id, label: d.name, icon: "image", href: `/design/${d.id}` })),
        },
      ]}
      onNavigate={(item) => item.href && navigate(item.href)}
      standalone={() => null}
    />
  );

  if (fontState.fontsError) {
    return <div class="flex flex-col items-center justify-center gap-3 h-full" role="alert">
      <p>{fontState.fontsError}</p>
      <button class="btn btn-secondary" onClick={() => window.location.reload()}>Reload</button>
    </div>;
  }

  // Fabric measures text during construction. Load fonts before mounting any canvas.
  if (designState.loading || fontState.fontsLoading) {
    return (
      <>
      {hostNav}
      <div class="flex items-center justify-center h-full bg-background">
        <p class="text-body-sm text-muted">Loading…</p>
      </div>
      </>
    );
  }

  // Home / gallery view
  if (!designId) {
    return (
      <>
      {hostNav}
      <Home
        designs={designState.designs}
        templates={designState.templates}
        navigate={navigate}
        createDesign={designState.createDesign}
        deleteDesign={designState.deleteDesign}
        renameDesign={designState.renameDesign}
        createFromTemplate={designState.createFromTemplate}
      />
      </>
    );
  }

  // Editor view
  const contextValue = {
    editors,
    dragPreviews,
    ...canvasState,
    ...designState,
    ...brandState,
    ...fontState,
    // activeCanvasId is the source of truth for which page is active
    activePageId: canvasState.activeCanvasId ?? designState.activePageId,
    navigate,
  };

  return (
    <EditorContext.Provider value={contextValue}>
      {hostNav}
      <Editor />
    </EditorContext.Provider>
  );
}
