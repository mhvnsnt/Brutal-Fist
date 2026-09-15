import { useEffect, useState } from 'react';

/**
 * Public asset loader for Google AI Studio / browser previews.
 *
 * No OAuth, Firebase session, API key, or Drive API listing is used.
 * The game consumes an "Anyone with the link" file directly.
 *
 * Supply a direct file URL with:
 *   VITE_PUBLIC_MODEL_URL=https://drive.google.com/file/d/<id>/view
 * or append ?model=<url> to the preview URL.
 */
function normalizePublicDriveUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return value;

  try {
    const url = new URL(value);

    // Drive file view/open URLs can be converted to Google's public media endpoint.
    if (url.hostname === 'drive.google.com') {
      const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
      const id = fileMatch?.[1] ?? url.searchParams.get('id');
      if (id) {
        return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
      }
    }

    return value;
  } catch {
    return value;
  }
}

function getConfiguredModelUrl(): string | null {
  const queryUrl = new URLSearchParams(window.location.search).get('model');
  const envUrl = import.meta.env.VITE_PUBLIC_MODEL_URL as string | undefined;
  const storedUrl = window.localStorage.getItem('brutal-fist.public-model-url');
  const raw = queryUrl || envUrl || storedUrl;
  return raw ? normalizePublicDriveUrl(raw) : null;
}

export function useDriveModel(startFetch: boolean) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startFetch || modelUrl) return;

    const sourceUrl = getConfiguredModelUrl();
    if (!sourceUrl) {
      setError('No public fighter model URL configured. Set VITE_PUBLIC_MODEL_URL or use ?model=.');
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    async function loadModel() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(sourceUrl, { mode: 'cors' });
        if (!response.ok) throw new Error(`Public fighter asset returned HTTP ${response.status}`);

        const blob = await response.blob();
        if (!blob.size) throw new Error('Public fighter asset was empty');

        objectUrl = URL.createObjectURL(blob);
        if (active) setModelUrl(objectUrl);
      } catch (err) {
        console.error('Public fighter asset load failed:', err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load public fighter asset');
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadModel();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [startFetch, modelUrl]);

  return { modelUrl, loading, error };
}
