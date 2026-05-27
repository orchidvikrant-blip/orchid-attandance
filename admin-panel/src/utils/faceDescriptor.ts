const LUXAND_API   = 'https://api.luxand.cloud';
const LUXAND_TOKEN = 'f0a8bfdc2d494fb4b60a072dd247908c';

// dataUrl → Blob helper
function dataUrlToBlob(dataUrl: string): Blob {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const byteStr = atob(base64);
  const ab = new ArrayBuffer(byteStr.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
  return new Blob([ab], { type: 'image/jpeg' });
}

// Register a face — creates person + uploads photo in one request
// Returns Luxand person UUID to store in Firebase
export async function registerFaceWithLuxand(name: string, photoDataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(photoDataUrl);

  const form = new FormData();
  form.append('name', name);
  form.append('store', '1');
  form.append('photos', blob, 'photo.jpg');

  const res = await fetch(`${LUXAND_API}/v2/person`, {
    method: 'POST',
    headers: { token: LUXAND_TOKEN },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Luxand registration failed: ${res.status} ${text}`);

  const data = JSON.parse(text);
  // Response can be {uuid} or [{uuid}] or {person: {uuid}}
  const uuid: string | undefined =
    data?.uuid ??
    data?.person?.uuid ??
    (Array.isArray(data) ? data[0]?.uuid : undefined);

  if (!uuid) throw new Error(`No UUID in Luxand response: ${text}`);
  return uuid;
}

export async function deleteFaceFromLuxand(uuid: string): Promise<void> {
  await fetch(`${LUXAND_API}/v2/person/${uuid}`, {
    method: 'DELETE',
    headers: { token: LUXAND_TOKEN },
  }).catch(() => undefined);
}
