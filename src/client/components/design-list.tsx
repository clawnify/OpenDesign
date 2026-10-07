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
        class="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer bg-accent text-zinc-900 hover:bg-accent-hover transition-all"
        onClick={async () => {
          const id = await createDesign();
          if (id) navigate(`/design/${id}`);
        }}
      >
        <Plus size={14} />
        New Design
      </button>

      {designs.length === 0 && (
        <p class="text-zinc-400 text-[11px] text-center py-4">No saved designs yet</p>
      )}

      {designs.map((d) => (
        <div
          key={d.id}
          class={`flex items-center px-2.5 py-2 rounded-lg border transition-all group cursor-pointer ${
            activeDesign?.id === d.id
              ? "border-accent bg-accent/10"
              : "border-zinc-200 bg-white hover:border-zinc-600"
          }`}
          onClick={() => {
            navigate(`/design/${d.id}`);
            loadDesign(d.id);
          }}
        >
          {editingId === d.id ? (
            <input
              class="flex-1 bg-zinc-100 border border-accent rounded text-zinc-700 text-xs px-1.5 py-0.5 outline-none"
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
              <span class="text-xs font-medium text-zinc-600 truncate block">{d.name}</span>
              <span class="text-[10px] text-zinc-600">
                {d.width}x{d.height} &middot;{" "}
                {new Date(d.updated_at).toLocaleDateString()}
              </span>
            </div>
          )}
          <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            <button
              class="p-1 rounded text-zinc-400 bg-transparent border-none cursor-pointer hover:text-zinc-800 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                startRename(d.id, d.name);
              }}
            >
              <Edit3 size={12} />
            </button>
            <button
              class="p-1 rounded text-zinc-400 bg-transparent border-none cursor-pointer hover:text-red-400 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                deleteDesign(d.id);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
