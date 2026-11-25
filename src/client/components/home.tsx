import { useState, useCallback } from "preact/hooks";
import { Plus, Trash2, Edit3, Sparkles } from "lucide-preact";
import type { Design, Template } from "../types";
import { api } from "../api";
import { TemplateCard } from "./template-card";

interface HomeProps {
  designs: Design[];
  templates: Template[];
  navigate: (to: string) => void;
  createDesign: () => Promise<string | undefined>;
  deleteDesign: (id: string) => Promise<void>;
  renameDesign: (id: string, name: string) => Promise<void>;
  createFromTemplate: (template: Template) => Promise<string | undefined>;
}

export function Home({
  designs,
  templates,
  navigate,
  createDesign,
  deleteDesign,
  renameDesign,
  createFromTemplate,
}: HomeProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = useCallback(async () => {
    const id = await createDesign();
    if (id) navigate(`/design/${id}`);
  }, [createDesign, navigate]);

  const handleTemplateClick = useCallback(
    async (t: Template) => {
      const id = await createFromTemplate(t);
      if (id) navigate(`/design/${id}`);
    },
    [createFromTemplate, navigate]
  );

  const startRename = (id: string, name: string, e: Event) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const finishRename = () => {
    if (editingId && editName.trim()) renameDesign(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div class="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div class="bg-surface border-b border-border">
        <div class="max-w-[80rem] mx-auto h-14 px-6 flex items-center justify-between">
          <div class="flex items-baseline gap-2">
            <h1 class="text-heading-1 text-foreground m-0">Designs</h1>
            <p class="text-body-sm text-muted tabular-nums m-0">
              {designs.length} design{designs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            class="btn btn-primary"
            onClick={handleCreate}
          >
            <Plus size={16} />
            New design
          </button>
        </div>
      </div>

      <div class="max-w-[80rem] mx-auto px-6 py-6">
        {/* Templates section */}
        {templates.length > 0 && (
          <div class="mb-8">
            <div class="flex items-center gap-2 mb-3">
              <Sparkles size={16} class="text-muted" />
              <h2 class="text-heading-2 text-foreground m-0">Start from a template</h2>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} onClick={() => handleTemplateClick(t)} />
              ))}
            </div>
          </div>
        )}

        {/* Designs grid */}
        {designs.length === 0 ? (
          <div class="text-center py-20">
            <div class="w-14 h-14 rounded-md bg-surface-sunken flex items-center justify-center mx-auto mb-4">
              <Plus size={24} class="text-muted" />
            </div>
            <p class="text-heading-3 text-foreground mb-1">No designs yet</p>
            <p class="text-body-sm text-muted mb-4">Start from a template above, or from a blank page.</p>
            <button
              class="btn btn-secondary"
              onClick={handleCreate}
            >
              <Plus size={16} />
              Blank design
            </button>
          </div>
        ) : (
          <>
            <h2 class="text-heading-2 text-foreground mb-3 m-0">Recent designs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {designs.map((d) => (
                <div
                  key={d.id}
                  class="card is-interactive cursor-pointer group"
                  onClick={() => navigate(`/design/${d.id}`)}
                >
                  {/* Preview area */}
                  <div class="aspect-[4/3] bg-surface-sunken flex items-center justify-center">
                    {d.thumbnail_url ? (
                      <img
                        src={d.thumbnail_url}
                        alt={d.name}
                        class="w-full h-full object-cover"
                      />
                    ) : (
                      <div class="text-fine text-faint tabular-nums">
                        {d.width} x {d.height}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div class="p-3">
                    {editingId === d.id ? (
                      <input
                        class="field h-7"
                        value={editName}
                        onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                        onBlur={finishRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") finishRename();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div class="flex items-start justify-between">
                        <div class="min-w-0 flex-1">
                          <p class="text-body-sm font-medium text-foreground truncate m-0">
                            {d.name}
                          </p>
                          <p class="text-fine text-muted tabular-nums mt-0.5 m-0">
                            {d.width} x {d.height} &middot;{" "}
                            {new Date(d.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ml-2 shrink-0" data-hover-only>
                          <button
                            class="btn btn-ghost btn-icon"
                            aria-label="Rename"
                            onClick={(e) => startRename(d.id, d.name, e)}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            class="btn btn-ghost btn-icon is-danger"
                            aria-label="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDesign(d.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
