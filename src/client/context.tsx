import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Design, Template, Page } from "./types";
import type * as fabric from "fabric";
import type { Dimensions } from "./resize";

export interface CanvasSize {
  group: string;
  label: string;
  width: number;
  height: number;
}

export const CANVAS_SIZES: CanvasSize[] = [
  { group: "LinkedIn", label: "LinkedIn Square", width: 1080, height: 1080 },
  { group: "LinkedIn", label: "LinkedIn Landscape", width: 1200, height: 627 },
  { group: "LinkedIn", label: "LinkedIn Portrait", width: 1200, height: 1500 },
  { group: "Instagram", label: "Instagram Portrait", width: 1080, height: 1350 },
  { group: "Instagram", label: "Instagram Story", width: 1080, height: 1920 },
  { group: "More", label: "Pinterest Pin", width: 1000, height: 1500 },
  { group: "More", label: "YouTube Thumbnail", width: 1280, height: 720 },
  { group: "More", label: "Presentation 16:9", width: 1920, height: 1080 },
];

// Guardrails for the custom size fields. The upper bound keeps a typo from
// allocating a canvas big enough to crash the tab.
export const MIN_CANVAS_SIDE = 50;
export const MAX_CANVAS_SIDE = 8000;

export interface EditorContextValue {
  // Canvas (multi-canvas)
  registerCanvas: (pageId: string, canvas: fabric.Canvas) => void;
  unregisterCanvas: (pageId: string) => void;
  setActiveCanvas: (pageId: string) => void;
  activeCanvasId: string | null;
  canvas: fabric.Canvas | null;
  selectedObject: fabric.FabricObject | null;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  setZoomRaw: (z: number) => void;
  fitScale: number;
  setFitScale: (s: number) => void;

  // Canvas actions
  addText: (preset: "heading" | "subheading" | "body") => void;
  addShape: (type: "rect" | "circle" | "line" | "triangle") => void;
  addImage: (url: string) => void;
  setBackground: (type: "color" | "gradient" | "image", value: string) => void;
  updateSelectedObject: (props: Record<string, unknown>) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setCanvasSize: (width: number, height: number, options?: { reflow?: boolean }) => void;
  getCanvasSize: () => Dimensions;
  undoResize: () => void;
  canUndoResize: boolean;
  zoomToFit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  exportPNG: () => void;
  getCanvasJSON: () => string;
  getCanvasJSONForPage: (pageId: string) => string;
  loadTemplate: (template: Template) => void;

  // Router
  navigate: (to: string) => void;

  // Designs
  designs: Design[];
  activeDesign: Design | null;
  createDesign: () => Promise<string | undefined>;
  createFromTemplate: (template: Template) => Promise<string | undefined>;
  loadDesign: (id: string) => Promise<void>;
  saveDesign: () => Promise<void>;
  deleteDesign: (id: string) => Promise<void>;
  renameDesign: (id: string, name: string) => Promise<void>;
  saving: boolean;

  // Pages
  pages: Page[];
  activePageId: string | null;
  activePage: Page | null;
  addPage: () => Promise<void>;
  duplicatePage: (pageId: string) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  renamePage: (pageId: string, title: string) => Promise<void>;
  switchToPage: (pageId: string) => void;

  // Templates
  templates: Template[];

  // State
  loading: boolean;
}

export const EditorContext = createContext<EditorContextValue>(null!);

export function useEditor() {
  return useContext(EditorContext);
}
