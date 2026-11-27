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
import { UploadGallery } from "./upload-gallery";
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
  const [galleryRevision, setGalleryRevision] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const handleSectionClick = (key: Section) => {
    setActiveSection((prev) => (prev === key ? null : key));
  };

  const handleImageUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setUploadError("");
      let uploaded = false;
      const errors: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const form = new FormData();
          form.append("file", file);
          const resp = await fetch("/api/uploads", { method: "POST", body: form });
          const data = await resp.json();
          if (!resp.ok || !data.url) throw new Error(data.error || "Upload failed");
          uploaded = true;
          addImage(data.url);
        } catch (e) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`);
        }
      }
      if (uploaded) setGalleryRevision((revision) => revision + 1);
      setUploadError(errors.join("\n"));
      setUploading(false);
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
      if (!uploading) void handleImageUpload(e.dataTransfer?.files ?? null);
    },
    [handleImageUpload, uploading]
  );

  const isOpen = activeSection !== null;

  return (
    <aside class="flex flex-row shrink-0">
      {/* Icon Rail */}
      <div class="w-[4.75rem] bg-surface-sunken border-r border-border flex flex-col items-center pt-2 gap-1 shrink-0">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            class={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-sm border-none cursor-pointer ${
              activeSection === s.key
                ? "bg-nav-active text-foreground"
                : "bg-transparent text-muted hover:bg-nav-active hover:text-foreground"
            }`}
            aria-pressed={activeSection === s.key}
            onClick={() => handleSectionClick(s.key)}
          >
            <s.icon size={20} />
            <span class="text-fine font-medium leading-none">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Content Panel */}
      <div
        class="bg-surface border-r border-border overflow-hidden transition-[width] duration-200 ease-in-out"
        style={{ width: isOpen ? "17.5rem" : "0" }}
      >
        <div class="editor-tools-content w-[17.5rem] h-full flex flex-col">
          {activeSection && (
            <>
              <div class="h-12 px-3 flex items-center shrink-0">
                <h2 class="text-heading-3 text-foreground m-0">
                  {SECTION_TITLES[activeSection]}
                </h2>
              </div>
              <div class="flex-1 overflow-y-auto px-3 pb-3">
                {activeSection === "templates" && (
                  <div>
                    {templates.length === 0 ? (
                      <p class="text-body-sm text-muted">No templates yet.</p>
                    ) : (
                      <>
                        <p class="text-body-sm text-muted mb-3">Click a template to apply</p>
                        <div class="grid grid-cols-2 gap-2">
                          {templates.map((t) => (
                            <TemplateCard key={t.id} template={t} onClick={() => loadTemplate(t)} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeSection === "brand" && <BrandKitPanel />}

                {activeSection === "text" && (
                  <div class="flex flex-col gap-2">
                    <p class="text-body-sm text-muted mb-1">Click to add text</p>
                    <button
                      class="card is-interactive w-full text-left p-3 border-none cursor-pointer"
                      onClick={() => addText("heading")}
                    >
                      <span class="text-heading-1 font-bold text-foreground">
                        Add a heading
                      </span>
                      <span class="block text-fine text-muted mt-1">
                        Montserrat Bold, 48px
                      </span>
                    </button>
                    <button
                      class="card is-interactive w-full text-left p-3 border-none cursor-pointer"
                      onClick={() => addText("subheading")}
                    >
                      <span class="text-body font-medium text-foreground">
                        Add a subheading
                      </span>
                      <span class="block text-fine text-muted mt-1">
                        Inter Medium, 32px
                      </span>
                    </button>
                    <button
                      class="card is-interactive w-full text-left p-3 border-none cursor-pointer"
                      onClick={() => addText("body")}
                    >
                      <span class="text-body-sm text-foreground">
                        Add body text
                      </span>
                      <span class="block text-fine text-muted mt-1">
                        Inter Regular, 18px
                      </span>
                    </button>
                  </div>
                )}

                {activeSection === "shapes" && (
                  <div>
                    <p class="text-body-sm text-muted mb-2">Click to add a shape</p>
                    <div class="grid grid-cols-2 gap-2">
                      {[
                        { type: "rect" as const, icon: Square, label: "Rectangle" },
                        { type: "circle" as const, icon: Circle, label: "Circle" },
                        { type: "triangle" as const, icon: Triangle, label: "Triangle" },
                        { type: "line" as const, icon: Minus, label: "Line" },
                      ].map((s) => (
                        <button
                          key={s.type}
                          class="card is-interactive flex flex-col items-center gap-1.5 p-3 border-none cursor-pointer"
                          onClick={() => addShape(s.type)}
                        >
                          <s.icon size={24} class="text-muted" />
                          <span class="text-label text-foreground">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeSection === "images" && (
                  <div>
                    <button
                      type="button"
                      disabled={uploading}
                      class="dropzone w-full p-6 text-center"
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <Upload size={24} class="mx-auto mb-2" />
                      <p class="text-body-sm">
                        {uploading ? "Uploading…" : "Click or drag images here"}
                      </p>
                      <p class="text-fine text-muted mt-1">PNG, JPG, GIF, SVG, WebP</p>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      class="hidden"
                      onChange={(e) => {
                        void handleImageUpload(e.currentTarget.files);
                        e.currentTarget.value = "";
                      }}
                    />
                    {uploadError && <p role="alert" class="text-body-sm whitespace-pre-line">{uploadError}</p>}
                    <UploadGallery key={galleryRevision} onAdd={addImage} />
                  </div>
                )}

                {activeSection === "background" && (
                  <div>
                    <p class="field-label">Solid colors</p>
                    <div class="grid grid-cols-4 gap-1.5 mb-4">
                      {BG_COLORS.map((c) => (
                        <button
                          key={c}
                          class="swatch w-full aspect-square"
                          style={{ background: c }}
                          onClick={() => setBackground("color", c)}
                        />
                      ))}
                    </div>

                    <p class="field-label">Custom color</p>
                    <input
                      type="color"
                      class="swatch w-full h-8"
                      onChange={(e) =>
                        setBackground("color", (e.target as HTMLInputElement).value)
                      }
                    />

                    <p class="field-label mt-4">Gradient presets</p>
                    <div class="grid grid-cols-3 gap-1.5 mb-4">
                      {GRADIENT_PRESETS.map((g, i) => (
                        <button
                          key={i}
                          class="swatch w-full aspect-square"
                          style={{ background: g }}
                          onClick={() => {
                            const match = g.match(/#[0-9a-f]{6}/gi);
                            if (match) setBackground("color", match[0]);
                          }}
                        />
                      ))}
                    </div>

                    <p class="field-label">Background image</p>
                    <button
                      class="btn btn-secondary w-full"
                      onClick={() => bgFileRef.current?.click()}
                    >
                      <Upload size={14} />
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
