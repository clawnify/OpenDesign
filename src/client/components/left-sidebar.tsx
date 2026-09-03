import { useState, useRef, useCallback } from "preact/hooks";
import {
  Type,
  Square,
  Circle,
  Triangle,
  Minus,
  Image,
  Upload,
  Palette,
  LayoutGrid,
  Sparkles,
  SwatchBook,
} from "lucide-preact";
import { useEditor } from "../context";
import { TemplateCard } from "./template-card";
import { DesignList } from "./design-list";
import { BrandKitPanel } from "./brand-kit-panel";

type Section = "templates" | "brand" | "text" | "shapes" | "images" | "background" | "designs";

const SECTIONS: { key: Section; icon: typeof LayoutGrid; label: string }[] = [
  { key: "templates", icon: Sparkles, label: "Templates" },
  { key: "brand", icon: SwatchBook, label: "Brand" },
  { key: "shapes", icon: Square, label: "Elements" },
  { key: "text", icon: Type, label: "Text" },
  { key: "images", icon: Upload, label: "Uploads" },
  { key: "background", icon: Palette, label: "Bg" },
  { key: "designs", icon: LayoutGrid, label: "Designs" },
];

const SECTION_TITLES: Record<Section, string> = {
  templates: "Templates",
  brand: "Brand Kit",
  shapes: "Elements",
  text: "Text",
  images: "Uploads",
  background: "Background",
  designs: "Designs",
};

const GRADIENT_PRESETS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

const BG_COLORS = [
  "#1a1a2e", "#0f172a", "#18181b", "#1e1b4b",
  "#ffffff", "#f8fafc", "#fafaf9", "#fef3c7",
  "#2563eb", "#7c3aed", "#dc2626", "#059669",
  "#0891b2", "#d97706", "#e11d48", "#4f46e5",
];

export function LeftSidebar() {
  const { addText, addShape, addImage, setBackground, templates, loadTemplate } = useEditor();
  const [activeSection, setActiveSection] = useState<Section | null>("templates");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const handleSectionClick = (key: Section) => {
    setActiveSection((prev) => (prev === key ? null : key));
  };

  const handleImageUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const form = new FormData();
          form.append("file", file);
          const resp = await fetch("/api/uploads", { method: "POST", body: form });
          const data = await resp.json();
          if (data.url) addImage(data.url);
        }
      } catch (e) {
        console.error("Upload failed:", e);
      } finally {
        setUploading(false);
      }
    },
    [addImage]
  );

  const handleBgUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const form = new FormData();
      form.append("file", files[0]);
      try {
        const resp = await fetch("/api/uploads", { method: "POST", body: form });
        const data = await resp.json();
        if (data.url) setBackground("image", data.url);
      } catch (e) {
        console.error("Bg upload failed:", e);
      }
    },
    [setBackground]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      handleImageUpload(e.dataTransfer?.files ?? null);
    },
    [handleImageUpload]
  );

  const isOpen = activeSection !== null;

  return (
    <aside class="flex flex-row shrink-0">
      {/* Icon Rail */}
      <div class="w-[70px] bg-white border-r border-zinc-200 flex flex-col items-center pt-2 gap-0.5 shrink-0">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            class={`flex flex-col items-center justify-center gap-0.5 w-[56px] h-[56px] rounded-lg bg-transparent border-none cursor-pointer transition-all ${
              activeSection === s.key
                ? "text-accent bg-accent/10"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
            }`}
            onClick={() => handleSectionClick(s.key)}
          >
            <s.icon size={20} />
            <span class="text-[10px] leading-tight">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Content Panel */}
      <div
        class="bg-white border-r border-zinc-200 overflow-hidden transition-all duration-200 ease-in-out"
        style={{ width: isOpen ? "240px" : "0px" }}
      >
        <div class="w-[240px] h-full flex flex-col">
          {activeSection && (
            <>
              <div class="px-3 pt-3 pb-2 shrink-0">
                <h2 class="text-xs font-semibold text-zinc-800 uppercase tracking-wide m-0">
                  {SECTION_TITLES[activeSection]}
                </h2>
              </div>
              <div class="flex-1 overflow-y-auto px-3 pb-3">
                {activeSection === "templates" && (
                  <div>
                    <p class="text-zinc-400 text-[11px] mb-3">Click a template to apply</p>
                    <div class="grid grid-cols-2 gap-2">
                      {templates.map((t) => (
                        <TemplateCard key={t.id} template={t} onClick={() => loadTemplate(t)} />
                      ))}
                    </div>
                  </div>
                )}

                {activeSection === "brand" && <BrandKitPanel />}

                {activeSection === "text" && (
                  <div class="flex flex-col gap-2">
                    <p class="text-zinc-400 text-[11px] mb-1">Click to add text</p>
                    <button
                      class="w-full text-left p-3 rounded-lg bg-white border border-zinc-200 cursor-pointer transition-all hover:border-accent hover:bg-accent/5 group"
                      onClick={() => addText("heading")}
                    >
                      <span class="text-lg font-bold text-zinc-900 group-hover:text-accent transition-colors">
                        Add a heading
                      </span>
                      <span class="block text-[10px] text-zinc-400 mt-0.5">
                        Montserrat Bold, 48px
                      </span>
                    </button>
                    <button
                      class="w-full text-left p-3 rounded-lg bg-white border border-zinc-200 cursor-pointer transition-all hover:border-accent hover:bg-accent/5 group"
                      onClick={() => addText("subheading")}
                    >
                      <span class="text-sm font-medium text-zinc-900 group-hover:text-accent transition-colors">
                        Add a subheading
                      </span>
                      <span class="block text-[10px] text-zinc-400 mt-0.5">
                        Inter Medium, 32px
                      </span>
                    </button>
                    <button
                      class="w-full text-left p-3 rounded-lg bg-white border border-zinc-200 cursor-pointer transition-all hover:border-accent hover:bg-accent/5 group"
                      onClick={() => addText("body")}
                    >
                      <span class="text-xs text-zinc-900 group-hover:text-accent transition-colors">
                        Add body text
                      </span>
                      <span class="block text-[10px] text-zinc-400 mt-0.5">
                        Inter Regular, 18px
                      </span>
                    </button>
                  </div>
                )}

                {activeSection === "shapes" && (
                  <div>
                    <p class="text-zinc-400 text-[11px] mb-2">Click to add a shape</p>
                    <div class="grid grid-cols-2 gap-2">
                      {[
                        { type: "rect" as const, icon: Square, label: "Rectangle" },
                        { type: "circle" as const, icon: Circle, label: "Circle" },
                        { type: "triangle" as const, icon: Triangle, label: "Triangle" },
                        { type: "line" as const, icon: Minus, label: "Line" },
                      ].map((s) => (
                        <button
                          key={s.type}
                          class="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-white border border-zinc-200 cursor-pointer transition-all hover:border-accent hover:bg-accent/5"
                          onClick={() => addShape(s.type)}
                        >
                          <s.icon size={24} class="text-zinc-400" />
                          <span class="text-[11px] text-zinc-400">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeSection === "images" && (
                  <div>
                    <p class="text-zinc-400 text-[11px] mb-2">Upload images to add to canvas</p>
                    <div
                      class="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center cursor-pointer transition-all hover:border-accent/50 hover:bg-accent/5"
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <Upload size={24} class="text-zinc-400 mx-auto mb-2" />
                      <p class="text-xs text-zinc-400">
                        {uploading ? "Uploading..." : "Click or drag images here"}
                      </p>
                      <p class="text-[10px] text-zinc-600 mt-1">PNG, JPG, SVG, WebP</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      class="hidden"
                      onChange={(e) => handleImageUpload((e.target as HTMLInputElement).files)}
                    />
                  </div>
                )}

                {activeSection === "background" && (
                  <div>
                    <p class="text-zinc-400 text-[11px] mb-2">Solid colors</p>
                    <div class="grid grid-cols-4 gap-1.5 mb-4">
                      {BG_COLORS.map((c) => (
                        <button
                          key={c}
                          class="w-full aspect-square rounded-md border border-zinc-300 cursor-pointer transition-all hover:scale-110 hover:border-accent"
                          style={{ background: c }}
                          onClick={() => setBackground("color", c)}
                        />
                      ))}
                    </div>

                    <p class="text-zinc-400 text-[11px] mb-2">Custom color</p>
                    <input
                      type="color"
                      class="w-full h-8 rounded-md border border-zinc-300 cursor-pointer bg-transparent"
                      onChange={(e) =>
                        setBackground("color", (e.target as HTMLInputElement).value)
                      }
                    />

                    <p class="text-zinc-400 text-[11px] mb-2 mt-4">Gradient presets</p>
                    <div class="grid grid-cols-3 gap-1.5 mb-4">
                      {GRADIENT_PRESETS.map((g, i) => (
                        <button
                          key={i}
                          class="w-full aspect-square rounded-md border border-zinc-300 cursor-pointer transition-all hover:scale-110 hover:border-accent"
                          style={{ background: g }}
                          onClick={() => {
                            const match = g.match(/#[0-9a-f]{6}/gi);
                            if (match) setBackground("color", match[0]);
                          }}
                        />
                      ))}
                    </div>

                    <p class="text-zinc-400 text-[11px] mb-2">Background image</p>
                    <button
                      class="w-full p-3 rounded-lg bg-white border border-zinc-200 cursor-pointer text-xs text-zinc-400 hover:border-accent hover:text-zinc-800 transition-all"
                      onClick={() => bgFileRef.current?.click()}
                    >
                      <Upload size={14} class="inline mr-1.5" />
                      Upload image
                    </button>
                    <input
                      ref={bgFileRef}
                      type="file"
                      accept="image/*"
                      class="hidden"
                      onChange={(e) => handleBgUpload((e.target as HTMLInputElement).files)}
                    />
                  </div>
                )}

                {activeSection === "designs" && <DesignList />}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
