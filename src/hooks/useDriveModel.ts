import { useEffect, useState } from 'react';

const DEFAULT_PUBLIC_DRIVE_URL = 'https://drive.google.com/file/d/19k_jmuiUYsAubZyx_bUL0m8svyYmevM5/view';

function getConfiguredUrl() {
  const queryUrl = new URLSearchParams(window.location.search).get('model');
  const envUrl = import.meta.env.VITE_PUBLIC_MODEL_URL;
  if (queryUrl && queryUrl !== 'undefined') return queryUrl;
  if (envUrl && envUrl !== 'undefined') return envUrl;
  return DEFAULT_PUBLIC_DRIVE_URL;
}

/** Loads a public Google Drive model without OAuth, Firebase, or a Drive API token. */
export function useDriveModel(startFetch: boolean) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startFetch || modelUrl) return;
    let active = true;
    let objectUrl: string | null = null;

    async function loadModel() {
      setLoading(true);
      setError(null);
      try {
        const publicUrl = getConfiguredUrl();
        const response = await fetch(`/api/public-model?url=${encodeURIComponent(publicUrl)}`);
        if (!response.ok) throw new Error(`Public fighter asset returned HTTP ${response.status}`);
        const blob = await response.blob();
        if (!blob.size) throw new Error('Public fighter asset was empty');
        objectUrl = URL.createObjectURL(blob);
        if (active) setModelUrl(objectUrl);
      } catch (err) {
        console.error('Public fighter asset load failed:', err);
        if (active) setError(err instanceof Error ? err.message : 'Failed to load public fighter asset');
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
