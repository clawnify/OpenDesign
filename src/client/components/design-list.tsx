import { useState } from "preact/hooks";
import { Trash2, Edit3, Plus } from "lucide-preact";
import { useEditor } from "../context";

export function DesignList() {
  const { designs, activeDesign, createDesign, loadDesign, deleteDesign, renameDesign, navigate } =
    useEditor();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const finishRename = () => {
    if (editingId && editName.trim()) renameDesign(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div class="flex flex-col gap-2">
      <button
        class="btn btn-secondary w-full"
        onClick={async () => {
          const id = await createDesign();
          if (id) navigate(`/design/${id}`);
        }}
      >
        <Plus size={16} />
        New design
      </button>

      {designs.length === 0 && (
        <p class="text-body-sm text-muted text-center py-4">No saved designs yet</p>
      )}

      {designs.map((d) => (
        <div
          key={d.id}
          class={`flex items-center px-2.5 py-2 rounded-sm group cursor-pointer ${
            activeDesign?.id === d.id ? "bg-nav-active" : "hover:bg-surface-sunken"
          }`}
          aria-current={activeDesign?.id === d.id ? "page" : undefined}
          onClick={() => {
            navigate(`/design/${d.id}`);
            loadDesign(d.id);
          }}
        >
          {editingId === d.id ? (
            <input
              class="field h-7 flex-1"
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
            <div class="flex-1 min-w-0">
              <span class="text-body-sm font-medium text-foreground truncate block">{d.name}</span>
              <span class="text-fine text-muted tabular-nums">
                {d.width}x{d.height} &middot;{" "}
                {new Date(d.updated_at).toLocaleDateString()}
              </span>
            </div>
          )}
          <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ml-1" data-hover-only>
            <button
              class="btn btn-ghost btn-icon"
              aria-label="Rename"
              onClick={(e) => {
                e.stopPropagation();
                startRename(d.id, d.name);
              }}
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
      ))}
    </div>
  );
}
