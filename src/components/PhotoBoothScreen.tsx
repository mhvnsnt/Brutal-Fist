import { useMemo, useState } from "react";
import { generateBoothArt } from "@/lib/photobooth";
import { loadBoothGallery, pixelateDataUrl, saveBoothShot, downscaleDataUrl, setSelectMugOverride, type BoothShot } from "@/lib/pixelate";
import { getAllBannonFighters } from "@/data/bannonRoster";

const POSES = [
  { id: "bust", label: "SELECT BUST", extra: "three-quarter bust, chin slightly down, eyes on camera" },
  { id: "guard", label: "GUARD STANCE", extra: "hands up in a fighting guard, weight on back foot" },
  { id: "victory", label: "VICTORY", extra: "one fist raised, roar, sweat and rim light" },
  { id: "stage", label: "STAGE PLATE", extra: "" },
];

interface Props {
  onBack: () => void;
}

export default function PhotoBoothScreen({ onBack }: Props) {
  const fighters = useMemo(() => getAllBannonFighters(), []);
  const [pose, setPose] = useState(POSES[0].id);
  const [fighterId, setFighterId] = useState(fighters[0]?.id ?? "bannon");
  const [prompt, setPrompt] = useState("Underground wrestling champion, scarred, midnight leather, cold steel light");
  const [fileData, setFileData] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concept, setConcept] = useState<string | null>(null);
  const [pixel, setPixel] = useState<string | null>(null);
  const [gallery, setGallery] = useState<BoothShot[]>(() => (typeof window === "undefined" ? [] : loadBoothGallery()));

  const fighter = fighters.find((f) => f.id === fighterId);
  const isStage = pose === "stage";

  async function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setFileData(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    const poseMeta = POSES.find((p) => p.id === pose);
    const full = isStage
      ? `Fighting game arena: ${prompt}`
      : `${fighter?.name ?? "Fighter"}, ${fighter?.fightingStyle ?? "striker"}. ${poseMeta?.extra}. ${prompt}`;
    let control = fileData;
    if (!control && !isStage && fighter?.conceptArtUrl) {
      try {
        control = await downscaleDataUrl(fighter.conceptArtUrl, 768);
      } catch {
        control = undefined;
      }
    } else if (control) {
      try {
        control = await downscaleDataUrl(control, 768);
      } catch {
        /* keep original */
      }
    }
    const raw = control?.includes(",") ? control.split(",")[1] : control;
    const result = await generateBoothArt({
      data: {
        prompt: full,
        imageBase64: raw,
        mode: isStage ? "stage" : "portrait",
      },
    });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    const pix = await pixelateDataUrl(result.image, 64);
    setConcept(result.image);
    setPixel(pix);
    const shot: BoothShot = {
      id: `${Date.now()}`,
      createdAt: Date.now(),
      mode: isStage ? "stage" : "portrait",
      prompt: full,
      concept: result.image,
      pixel: pix,
      fighterId: isStage ? undefined : fighterId,
    };
    setGallery(saveBoothShot(shot));
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-bg text-fg font-mono">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="text-[10px] tracking-[0.35em] text-subtle">CONTROLNET BOOTH</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">PHOTO STUDIO</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Pose reference in, high-res concept art out. Pixel copies stay for in-fight HUD. Select boxes always use the clean plate.
            </p>
          </div>
          <button
            onClick={onBack}
            className="h-10 rounded-[var(--radius-sm)] border border-border px-4 text-xs tracking-[0.2em] text-muted hover:text-fg"
          >
            BACK
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POSES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPose(p.id)}
                  className={`h-10 rounded-[var(--radius-sm)] border text-[10px] tracking-[0.16em] ${
                    pose === p.id ? "border-accent bg-elevated text-fg" : "border-border text-subtle hover:text-fg"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {!isStage && (
              <label className="block text-[10px] tracking-[0.2em] text-subtle">
                FIGHTER
                <select
                  value={fighterId}
                  onChange={(e) => setFighterId(e.target.value)}
                  className="mt-2 h-10 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-fg"
                >
                  {fighters.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-[10px] tracking-[0.2em] text-subtle">
              POSE / CONTROL PHOTO
              <input
                type="file"
                accept="image/*"
                className="mt-2 block w-full text-xs text-muted"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
            </label>
            {fileData && (
              <img src={fileData} alt="" className="h-28 w-28 rounded-[var(--radius-sm)] object-cover" />
            )}

            <label className="block text-[10px] tracking-[0.2em] text-subtle">
              LOOK
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-[var(--radius-md)] border border-border bg-bg p-3 text-sm text-fg"
              />
            </label>

            <button
              disabled={busy}
              onClick={() => void generate()}
              className="h-11 w-full rounded-[var(--radius-md)] bg-accent text-sm font-semibold tracking-[0.18em] text-accent-fg disabled:opacity-50"
            >
              {busy ? "EXPOSING…" : "SHOOT"}
            </button>
            {error && <div className="text-sm text-p2">{error}</div>}
            {concept && !isStage && (
              <button
                onClick={() => {
                  setSelectMugOverride(fighterId, concept);
                }}
                className="h-10 w-full rounded-[var(--radius-sm)] border border-border text-[10px] tracking-[0.2em] text-muted hover:text-fg"
              >
                USE ON SELECT GRID
              </button>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-elevated">
              <figcaption className="px-3 py-2 text-[10px] tracking-[0.25em] text-subtle">CONCEPT / SELECT</figcaption>
              {concept ? (
                <img src={concept} alt="Concept art" className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-xs tracking-[0.2em] text-subtle">NO PLATE</div>
              )}
            </figure>
            <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-elevated">
              <figcaption className="px-3 py-2 text-[10px] tracking-[0.25em] text-subtle">PIXEL / IN-GAME</figcaption>
              {pixel ? (
                <img src={pixel} alt="Pixel sprite" className="aspect-[3/4] w-full object-cover" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-xs tracking-[0.2em] text-subtle">NO SPRITE</div>
              )}
            </figure>
          </section>
        </div>

        {gallery.length > 0 && (
          <section>
            <div className="mb-3 text-[10px] tracking-[0.3em] text-subtle">SESSION ROLLS</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {gallery.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { setConcept(g.concept); setPixel(g.pixel); }}
                  className="overflow-hidden rounded-[var(--radius-sm)] border border-border"
                >
                  <img src={g.concept} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
