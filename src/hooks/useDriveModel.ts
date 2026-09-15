import { useEffect, useState } from 'react';

const DEFAULT_PUBLIC_DRIVE_URL = 'https://drive.google.com/file/d/19k_jmuiUYsAubZyx_bUL0m8svyYmevM5/view';

function getConfiguredUrl(modelFile?: string) {
  const queryUrl = new URLSearchParams(window.location.search).get('model');
  const envUrl = import.meta.env.VITE_PUBLIC_MODEL_URL;
  if (queryUrl && queryUrl !== 'undefined') return queryUrl;
  if (modelFile) return `/BannonSource/assets/models/${encodeURIComponent(modelFile)}`;
  if (envUrl && envUrl !== 'undefined') return envUrl;
  return DEFAULT_PUBLIC_DRIVE_URL;
}

/** Loads the exact manifest-selected Bannon GLB; Drive is only an unbound development override. */
export function useDriveModel(startFetch: boolean, modelFile?: string) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startFetch) {
      setModelUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;

    async function loadModel() {
      setLoading(true);
      setError(null);
      setModelUrl(null);
      try {
        const publicUrl = getConfiguredUrl(modelFile);
        const response = await fetch(publicUrl);
        if (!response.ok) throw new Error(`Fighter GLB returned HTTP ${response.status}: ${modelFile ?? 'unconfigured'}`);
        const blob = await response.blob();
        if (!blob.size) throw new Error('Fighter GLB was empty');
        objectUrl = URL.createObjectURL(blob);
        if (active) setModelUrl(objectUrl);
      } catch (err) {
        console.error('Exact Bannon fighter GLB load failed:', err);
        if (active) setError(err instanceof Error ? err.message : 'Failed to load exact Bannon fighter GLB');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadModel();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [startFetch, modelFile]);

  return { modelUrl, loading, error };
}
