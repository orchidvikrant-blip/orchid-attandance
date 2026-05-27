const LUXAND_API   = 'https://api.luxand.cloud';
const LUXAND_TOKEN = 'f0a8bfdc2d494fb4b60a072dd247908c';

let ready = false;
export type ProgressFn = (msg: string) => void;

export async function initTensorFlow(onProgress?: ProgressFn): Promise<void> {
  if (ready) return;
  onProgress?.('Connecting...');
  ready = true;
}

export function isTfReady(): boolean { return ready; }

export interface LuxandMatch {
  uuid: string;
  name: string;
  similarity: number;
}

// Sends photo file URI to Luxand and returns matched person, or null
export async function recognizeWithLuxand(photoUri: string): Promise<LuxandMatch | null> {
  try {
    // Fetch the local file URI as a Blob (avoids FormDataPart issues in RN 0.85)
    const fileBlob = await fetch(photoUri).then(r => r.blob());

    const form = new FormData();
    form.append('photo', fileBlob, 'scan.jpg');

    const res = await fetch(`${LUXAND_API}/photo/search`, {
      method: 'POST',
      headers: { token: LUXAND_TOKEN },
      body: form,
    });

    const text = await res.text();
    console.log('Luxand HTTP status:', res.status);
    console.log('Luxand raw response:', text);

    if (!res.ok) return null;

    const data = JSON.parse(text);
    if (data.status === 'success' && Array.isArray(data.result) && data.result.length > 0) {
      const r = data.result[0];
      return { uuid: r.uuid ?? r.person_id ?? '', name: r.name ?? '', similarity: r.similarity ?? 0 };
    }
    // Return debug info when no match
    return null;
  } catch (e) {
    console.warn('Luxand search error:', e);
    return null;
  }
}
