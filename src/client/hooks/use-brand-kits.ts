import { useState, useCallback, useEffect } from "preact/hooks";
import type { BrandKit } from "../types";
import { api } from "../api";

type KitInput = Partial<Omit<BrandKit, "id" | "created_at" | "updated_at">>;

/**
 * Brand kits are an install-wide resource, not a per-design one: the whole
 * point is that the same colours and fonts follow every design. An agency
 * running one OpenDesign for several clients keeps one kit per client, so
 * this is a list with a selection rather than a single settings row.
 */
export function useBrandKits() {
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [activeBrandKitId, setActiveBrandKitId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const kits = await api<BrandKit[]>("GET", "/api/brand-kits");
        setBrandKits(kits);
        setActiveBrandKitId((prev) => prev ?? kits[0]?.id ?? null);
      } catch (e) {
        console.error("Failed to load brand kits:", e);
      }
    })();
  }, []);

  const createBrandKit = useCallback(async (input?: KitInput) => {
    const kit = await api<BrandKit>("POST", "/api/brand-kits", input ?? {});
    setBrandKits((prev) => [...prev, kit]);
    setActiveBrandKitId(kit.id);
    return kit;
  }, []);

  const updateBrandKit = useCallback(async (id: string, input: KitInput) => {
    // Optimistic: the panel is a live editor, and waiting on a round trip for
    // every swatch click makes it feel broken.
    setBrandKits((prev) => prev.map((k) => (k.id === id ? { ...k, ...input } : k)));
    try {
      const kit = await api<BrandKit>("PUT", `/api/brand-kits/${id}`, input);
      setBrandKits((prev) => prev.map((k) => (k.id === id ? kit : k)));
    } catch (e) {
      console.error("Failed to save brand kit:", e);
    }
  }, []);

  const deleteBrandKit = useCallback(async (id: string) => {
    await api<{ ok: boolean }>("DELETE", `/api/brand-kits/${id}`);
    setBrandKits((prev) => {
      const next = prev.filter((k) => k.id !== id);
      setActiveBrandKitId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }, []);

  const activeBrandKit = brandKits.find((k) => k.id === activeBrandKitId) ?? null;

  return {
    brandKits,
    activeBrandKit,
    activeBrandKitId,
    setActiveBrandKitId,
    createBrandKit,
    updateBrandKit,
    deleteBrandKit,
  };
}
