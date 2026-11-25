import { useRef, useState } from "preact/hooks";
import { ChevronDown, ChevronUp } from "lucide-preact";
import { useEditor } from "../context";
import { FONT_FAMILIES } from "../fonts";

export function FontPicker({ value, onChange, label }: {
  value: string;
  onChange: (family: string) => void;
  label: string;
}) {
  const { customFonts, importFont } = useEditor();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `font-options-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const fonts = [
    ...FONT_FAMILIES.map((family) => ({ family, name: family })),
    ...customFonts,
  ];

  return <div>
    <label class="field-label">{label}</label>
    <button
      type="button"
      aria-label={`${label}: ${fonts.find((font) => font.family === value)?.name ?? `${value} (unavailable)`}`}
      aria-expanded={open}
      aria-controls={id}
      class="field flex items-center justify-between text-left cursor-pointer"
      onClick={() => setOpen(!open)}
    >
      <span style={{ fontFamily: value }}>{fonts.find((font) => font.family === value)?.name ?? `${value} (unavailable)`}</span>
      {open ? <ChevronUp size={14} class="text-muted" /> : <ChevronDown size={14} class="text-muted" />}
    </button>
    {open && <div id={id} role="group" aria-label="Available fonts" class="menu mt-1 max-h-56 overflow-y-auto">
      {fonts.map((font) => (
        <button
          key={font.family}
          type="button"
          aria-pressed={value === font.family}
          class="menu-item justify-between gap-3"
          onClick={() => { onChange(font.family); setOpen(false); }}
        >
          <span class="truncate" style={{ fontFamily: font.family }}>{font.name}</span>
          <span class="shrink-0 text-body-sm text-muted" style={{ fontFamily: font.family }}>Aa 123</span>
        </button>
      ))}
    </div>}
    <button
      type="button"
      disabled={busy}
      class="mt-1.5 p-0 text-label text-link underline decoration-border underline-offset-2 bg-transparent border-none cursor-pointer hover:decoration-foreground disabled:opacity-50"
      onClick={() => input.current?.click()}
    >{busy ? "Importing…" : "Import font from computer…"}</button>
    <input
      ref={input}
      type="file"
      accept=".ttf,.otf,.woff,.woff2"
      class="hidden"
      aria-label={`Import ${label.toLowerCase()}`}
      onChange={async (e) => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
          onChange(await importFont(file));
        } catch (error) {
          setError(error instanceof Error ? error.message : "Could not import the font.");
        } finally {
          setBusy(false);
        }
      }}
    />
    {error && <p role="alert" class="text-fine text-danger mt-1">{error}</p>}
  </div>;
}
