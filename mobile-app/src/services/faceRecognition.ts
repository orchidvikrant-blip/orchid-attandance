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

// Sends photo file URI to Luxand and returns matched person UUID, or null
export async function recognizeWithLuxand(photoUri: string): Promise<string | null> {
  try {
    const form = new FormData();
    // React Native file upload — URI approach, no atob needed
    form.append('photo', { uri: photoUri, name: 'scan.jpg', type: 'image/jpeg' } as any);

    const res = await fetch(`${LUXAND_API}/photo/search`, {
      method: 'POST',
      headers: { token: LUXAND_TOKEN },
      body: form,
    });

    if (!res.ok) {
      console.warn('Luxand search HTTP error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    console.log('Luxand result:', JSON.stringify(data));

    if (data.status === 'success' && Array.isArray(data.result) && data.result.length > 0) {
      return data.result[0].uuid as string;
    }
    return null;
  } catch (e) {
    console.warn('Luxand search error:', e);
    return null;
  }
}
