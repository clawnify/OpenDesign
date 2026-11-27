import { useEffect, useState } from "preact/hooks";
import { api } from "../api";

interface UploadedImage {
  name: string;
  url: string;
}

interface UploadPage {
  images: UploadedImage[];
  cursor: string | null;
}

export function UploadGallery({ onAdd }: { onAdd: (url: string) => void }) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [request, setRequest] = useState({ cursor: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const query = request.cursor ? `?cursor=${encodeURIComponent(request.cursor)}` : "";
    setLoading(true);
    setError(false);
    api<UploadPage>("GET", `/api/uploads${query}`)
      .then((page) => {
        if (!active) return;
        setImages((prev) => [...prev, ...page.images]);
        setNextCursor(page.cursor);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request]);

  return (
    <div class="mt-4">
      <div class="grid grid-cols-2 gap-2">
        {images.map((image) => (
          <button
            type="button"
            key={image.url}
            class="card is-interactive min-w-0 overflow-hidden p-1 cursor-pointer"
            aria-label={`Add ${image.name} to canvas`}
            title={image.name}
            onClick={() => onAdd(image.url)}
          >
            <img class="w-full h-20 object-contain" src={image.url} alt="" loading="lazy" />
            <span class="block truncate text-fine">{image.name}</span>
          </button>
        ))}
      </div>
      {loading && <p role="status" class="text-body-sm text-muted">Loading uploads…</p>}
      {error && <p role="alert" class="text-body-sm">Couldn’t load saved uploads.</p>}
      {!loading && (error || nextCursor) && (
        <button class="btn btn-secondary mt-2" onClick={() => setRequest({ cursor: error ? request.cursor : nextCursor! })}>
          {error ? "Retry" : "Load more"}
        </button>
      )}
    </div>
  );
}
