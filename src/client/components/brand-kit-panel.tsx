import { useRef, useState } from "preact/hooks";
import { Upload, Plus, Trash2, Download, Wand2 } from "lucide-preact";
import { useEditor } from "../context";
import { FONT_FAMILIES } from "../fonts";
import { exportKit, importKit } from "../lib/kit-transfer";

export function BrandKitPanel() {
  const {
    brandKits,
    activeBrandKit,
    activeBrandKitId,
    setActiveBrandKitId,
    createBrandKit,
    updateBrandKit,
    deleteBrandKit,
    applyBrandKit,
    addImage,
    selectedObject,
    updateSelectedObject,
    setBackground,
  } = useEditor();

  // A swatch click means "make the thing I have selected this colour"; with
  // nothing selected the only sensible target is the page background.
  const applyBrandColor = (color: string) => {
    if (selectedObject) updateSelectedObject({ fill: color });
    else setBackground("color", color);
  };

  const logoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Holds the label of the async operation in flight, or null. One state rather
  // than a boolean so the indicator says which of upload / export / import is running.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogoUpload = async (files: FileList | null) => {
    if (!files?.length || !activeBrandKit) return;
    setBusy("Uploading…");
    try {
      const form = new FormData();
      form.append("file", files[0]);
      const resp = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await resp.json();
      if (data.url) {
        await updateBrandKit(activeBrandKit.id, { logos: [...activeBrandKit.logos, data.url] });
      }
    } catch (e) {
      console.error("Logo upload failed:", e);
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    if (!activeBrandKit) return;
    setError(null);
    setBusy("Exporting…");
    try {
      const { json, missing } = await exportKit(activeBrandKit);
      const blob = new Blob([json], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${activeBrandKit.name.replace(/[^\w-]+/g, "-").toLowerCase()}.brandkit.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      if (missing > 0) setError(`Exported, but ${missing} logo(s) could not be read.`);
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setBusy("Importing…");
    try {
      const result = await importKit(await files[0].text());
      if (!result) {
        setError("That file is not an OpenDesign brand kit.");
        return;
      }
      await createBrandKit(result.kit);
      if (result.missing > 0) setError(`Imported, but ${result.missing} logo(s) could not be saved.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      {/* Kit selector */}
      <div class="flex gap-1.5">
        <select
          class="flex-1 min-w-0 bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none cursor-pointer focus:border-accent"
          value={activeBrandKitId ?? ""}
          onChange={(e) => setActiveBrandKitId((e.target as HTMLSelectElement).value || null)}
          aria-label="Active brand kit"
        >
          {brandKits.length === 0 && <option value="">No brand kit yet</option>}
          {brandKits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <button
          class="shrink-0 p-1.5 rounded-md border border-zinc-300 bg-white text-zinc-500 cursor-pointer hover:border-accent hover:text-accent transition-all"
          onClick={() => createBrandKit()}
          title="New brand kit"
          aria-label="New brand kit"
        >
          <Plus size={14} />
        </button>
      </div>

      {!activeBrandKit ? (
        <p class="text-[11px] text-zinc-400 leading-relaxed">
          A brand kit holds the colors, fonts and logos you reuse on every design. Create one, then
          apply it to any design in a click.
        </p>
      ) : (
        <>
          {/* Name */}
          <div>
            <label class="text-[11px] text-zinc-400 mb-1 block">Kit name</label>
            <input
              type="text"
              class="w-full bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none focus:border-accent"
              value={activeBrandKit.name}
              onChange={(e) =>
                updateBrandKit(activeBrandKit.id, {
                  name: (e.target as HTMLInputElement).value || "My Brand",
                })
              }
            />
          </div>

          {/* Colors */}
          <div>
            <label class="text-[11px] text-zinc-400 mb-1.5 block">
              Brand colors{" "}
              <span class="text-zinc-300">— click to apply to selection</span>
            </label>
            <div class="grid grid-cols-5 gap-1.5">
              {activeBrandKit.colors.map((color, i) => (
                <div key={`${color}-${i}`} class="relative group">
                  <button
                    class="w-full aspect-square rounded-md border border-zinc-300 cursor-pointer transition-all hover:scale-110 hover:border-accent"
                    style={{ background: color }}
                    title={color}
                    aria-label={`Brand color ${color}`}
                    onClick={() => applyBrandColor(color)}
                  />
                  <button
                    class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-white border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    title={`Remove ${color}`}
                    aria-label={`Remove brand color ${color}`}
                    onClick={() =>
                      updateBrandKit(activeBrandKit.id, {
                        colors: activeBrandKit.colors.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <span class="text-[9px] leading-none">×</span>
                  </button>
                </div>
              ))}
              {activeBrandKit.colors.length < 24 && (
                <label class="w-full aspect-square rounded-md border border-dashed border-zinc-300 cursor-pointer flex items-center justify-center text-zinc-400 hover:border-accent hover:text-accent transition-all">
                  <Plus size={14} />
                  <input
                    type="color"
                    class="sr-only"
                    aria-label="Add brand color"
                    onChange={(e) =>
                      updateBrandKit(activeBrandKit.id, {
                        colors: [...activeBrandKit.colors, (e.target as HTMLInputElement).value],
                      })
                    }
                  />
                </label>
              )}
            </div>
          </div>

          {/* Fonts */}
          <div class="flex flex-col gap-2">
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Heading font</label>
              <select
                class="w-full bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none cursor-pointer focus:border-accent"
                value={activeBrandKit.heading_font}
                onChange={(e) =>
                  updateBrandKit(activeBrandKit.id, {
                    heading_font: (e.target as HTMLSelectElement).value,
                  })
                }
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label class="text-[11px] text-zinc-400 mb-1 block">Body font</label>
              <select
                class="w-full bg-white border border-zinc-300 rounded-md text-xs text-zinc-700 px-2 py-1.5 outline-none cursor-pointer focus:border-accent"
                value={activeBrandKit.body_font}
                onChange={(e) =>
                  updateBrandKit(activeBrandKit.id, {
                    body_font: (e.target as HTMLSelectElement).value,
                  })
                }
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Logos */}
          <div>
            <label class="text-[11px] text-zinc-400 mb-1.5 block">
              Logos <span class="text-zinc-300">— click to place</span>
            </label>
            <div class="grid grid-cols-3 gap-1.5">
              {activeBrandKit.logos.map((url, i) => (
                <div key={url} class="relative group">
                  <button
                    class="w-full aspect-square rounded-md border border-zinc-200 bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#ffffff_0%_50%)] bg-[length:12px_12px] cursor-pointer p-1 hover:border-accent transition-all"
                    onClick={() => addImage(url)}
                    title="Add logo to canvas"
                  >
                    <img src={url} alt="" class="w-full h-full object-contain" />
                  </button>
                  <button
                    class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-white border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label="Remove logo"
                    onClick={() =>
                      updateBrandKit(activeBrandKit.id, {
                        logos: activeBrandKit.logos.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <span class="text-[9px] leading-none">×</span>
                  </button>
                </div>
              ))}
              {activeBrandKit.logos.length < 12 && (
                <button
                  class="w-full aspect-square rounded-md border border-dashed border-zinc-300 cursor-pointer flex items-center justify-center text-zinc-400 hover:border-accent hover:text-accent transition-all"
                  onClick={() => logoInputRef.current?.click()}
                  aria-label="Upload logo"
                >
                  <Upload size={14} />
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              class="hidden"
              onChange={(e) => handleLogoUpload((e.target as HTMLInputElement).files)}
            />
          </div>

          {/* Apply */}
          <button
            class="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent text-white border-none cursor-pointer text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => applyBrandKit(activeBrandKit)}
            disabled={activeBrandKit.colors.length === 0}
            title={
              activeBrandKit.colors.length === 0
                ? "Add at least one brand color first"
                : "Apply brand fonts and colors to this page"
            }
          >
            <Wand2 size={13} />
            Apply to this page
          </button>

          {/* Portability */}
          <div class="pt-1 border-t border-zinc-200">
            <p class="text-[10px] text-zinc-400 mt-2 mb-1.5 leading-relaxed">
              Your kit is a plain JSON file. Take it to another OpenDesign install, or hand it to a
              client.
            </p>
            <div class="flex gap-1.5">
              <button
                class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md border border-zinc-300 bg-white text-[11px] text-zinc-500 cursor-pointer hover:border-accent hover:text-accent transition-all"
                onClick={handleExport}
              >
                <Download size={12} />
                Export
              </button>
              <button
                class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md border border-zinc-300 bg-white text-[11px] text-zinc-500 cursor-pointer hover:border-accent hover:text-accent transition-all"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={12} />
                Import
              </button>
              <button
                class="shrink-0 p-1.5 rounded-md border border-zinc-300 bg-white text-zinc-400 cursor-pointer hover:border-red-400 hover:text-red-500 transition-all"
                onClick={() => deleteBrandKit(activeBrandKit.id)}
                title="Delete this kit"
                aria-label="Delete this brand kit"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              class="hidden"
              onChange={(e) => handleImport((e.target as HTMLInputElement).files)}
            />
            {busy && <p class="text-[10px] text-zinc-400 mt-1.5">{busy}</p>}
            {error && <p class="text-[10px] text-red-500 mt-1.5">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
