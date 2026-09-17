import { getAllBannonFighters } from "@/data/bannonRoster";

interface Props {
  onBack: () => void;
}

export default function ConceptArtGallery({ onBack }: Props) {
  const fighters = getAllBannonFighters().filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);

  return (
    <div className="fixed inset-0 overflow-auto bg-bg text-fg">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <header className="mb-6 flex items-end justify-between border-b border-border pb-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.35em] text-subtle">ART BOOK</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">CONCEPT vs PIXEL</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Select-screen plates stay full resolution. Pixel copies are the in-fight HUD sprites — same identity, different surface.
            </p>
          </div>
          <button
            onClick={onBack}
            className="h-10 rounded-[var(--radius-sm)] border border-border px-4 font-mono text-xs tracking-[0.2em] text-muted hover:text-fg"
          >
            BACK
          </button>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fighters.map((f) => {
            const concept = f.conceptArtUrl ?? `/portraits/concept/${f.id}.jpg?v=ai3`;
            const pixel = f.pixelPortrait ?? `/portraits/pixel/${f.id}.png`;
            return (
              <article key={f.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
                <div className="grid grid-cols-2">
                  <img src={concept} alt={`${f.name} concept`} className="aspect-square w-full object-cover" />
                  <img src={pixel} alt={`${f.name} pixel`} className="aspect-square w-full object-cover" style={{ imageRendering: "pixelated" }} />
                </div>
                <div className="flex items-center justify-between px-3 py-2 font-mono">
                  <span className="text-sm tracking-[0.12em]">{f.name.toUpperCase()}</span>
                  <span className="text-[10px] tracking-[0.2em] text-subtle">HQ / 64</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
