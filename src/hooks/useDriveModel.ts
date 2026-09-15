import { useState, useEffect } from 'react';
import { getAccessToken } from '../lib/firebase';

const FOLDER_ID = '19k_jmuiUYsAubZyx_bUL0m8svyYmevM5';

export function useDriveModel(startFetch: boolean) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startFetch) return;
    let active = true;

    async function loadModel() {
      setLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");

        // List files in the folder
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch from Drive");
        const data = await res.json();
        
        // Find a .glb file
        const glbFile = data.files?.find((f: any) => f.name.endsWith('.glb'));
        if (!glbFile) {
          throw new Error("No .glb file found in the specified Drive folder");
        }

        // Download the file
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${glbFile.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!dlRes.ok) throw new Error("Failed to download model");
        
        const blob = await dlRes.blob();
        if (active) {
          const url = URL.createObjectURL(blob);
          setModelUrl(url);
        }
      } catch (err: any) {
        console.error(err);
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (!modelUrl) {
      loadModel();
    }

    return () => {
      active = false;
    };
  }, [startFetch, modelUrl]);

  return { modelUrl, loading, error };
}
