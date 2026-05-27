const LUXAND_API  = 'https://api.luxand.cloud';
const LUXAND_TOKEN = 'f0a8bfdc2d494fb4b60a072dd247908c';

let ready = false;
export type ProgressFn = (msg: string) => void;

export async function initTensorFlow(onProgress?: ProgressFn): Promise<void> {
  if (ready) return;
  onProgress?.('Connecting to recognition service...');
  // Verify connectivity with a lightweight call
  try {
    const res = await fetch(`${LUXAND_API}/person`, {
      method: 'GET',
      headers: { token: LUXAND_TOKEN },
    });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  } catch (e: any) {
    throw new Error(`Cannot reach Luxand API: ${e.message}`);
  }
  onProgress?.('Ready');
  ready = true;
}

export function isTfReady(): boolean { return ready; }

// Convert base64 string to Blob (React Native compatible)
function base64ToBlob(base64: string): Blob {
  const byteStr = atob(base64);
  const ab = new ArrayBuffer(byteStr.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
  return new Blob([ab], { type: 'image/jpeg' });
}

// Returns the Luxand person UUID of the recognised face, or null if no match
export async function recognizeWithLuxand(base64Jpeg: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append('photo', base64ToBlob(base64Jpeg), 'scan.jpg');

    const res = await fetch(`${LUXAND_API}/photo/search`, {
      method: 'POST',
      headers: { token: LUXAND_TOKEN },
      body: form,
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 'success' && Array.isArray(data.result) && data.result.length > 0) {
      return data.result[0].uuid as string;
    }
    return null;
  } catch (e) {
    console.warn('Luxand search error:', e);
    return null;
  }
}
