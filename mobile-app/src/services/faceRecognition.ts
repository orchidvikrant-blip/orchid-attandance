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

// Sends photo file URI to Luxand using XHR (most reliable in React Native / Hermes)
export function recognizeWithLuxand(photoUri: string): Promise<LuxandMatch | null> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${LUXAND_API}/photo/search`);
    xhr.setRequestHeader('token', LUXAND_TOKEN);

    const form = new FormData();
    (form as any).append('photo', { uri: photoUri, type: 'image/jpeg', name: 'scan.jpg' });
    (form as any).append('threshold', '0.6'); // more permissive matching

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      console.log('Luxand status:', xhr.status, 'body:', xhr.responseText?.slice(0, 300));
      try {
        const data = JSON.parse(xhr.responseText);
        // Luxand returns [] for no match, or [{uuid,name,similarity,...}] for match
        const arr: any[] = Array.isArray(data) ? data
          : Array.isArray(data.result) ? data.result
          : [];
        if (arr.length > 0) {
          const r = arr[0];
          resolve({ uuid: r.uuid ?? r.person_id ?? '', name: r.name ?? '', similarity: r.similarity ?? 0 });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };

    xhr.onerror = () => { console.warn('Luxand XHR network error'); resolve(null); };
    xhr.ontimeout = () => { console.warn('Luxand XHR timeout'); resolve(null); };
    xhr.timeout = 12000;
    xhr.send(form);
  });
}
