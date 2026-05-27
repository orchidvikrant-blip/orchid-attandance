const LUXAND_API   = 'https://api.luxand.cloud';
const LUXAND_TOKEN = 'f0a8bfdc2d494fb4b60a072dd247908c';

// Register a person's face with Luxand and return their UUID.
// photoDataUrl — data:image/jpeg;base64,... from canvas
export async function registerFaceWithLuxand(name: string, photoDataUrl: string): Promise<string> {
  // 1. Create person
  const createRes = await fetch(`${LUXAND_API}/person`, {
    method: 'POST',
    headers: { token: LUXAND_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Luxand create person failed: ${createRes.status} ${txt}`);
  }
  const { uuid } = await createRes.json() as { uuid: string };

  // 2. Upload photo as multipart/form-data
  const base64 = photoDataUrl.includes(',') ? photoDataUrl.split(',')[1] : photoDataUrl;
  const byteStr = atob(base64);
  const ab = new ArrayBuffer(byteStr.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
  const blob = new Blob([ab], { type: 'image/jpeg' });
  const formData = new FormData();
  formData.append('photo', blob, 'photo.jpg');

  const photoRes = await fetch(`${LUXAND_API}/person/${uuid}/photo`, {
    method: 'POST',
    headers: { token: LUXAND_TOKEN }, // no Content-Type — browser sets multipart boundary
    body: formData,
  });
  if (!photoRes.ok) {
    // Clean up orphan person
    await fetch(`${LUXAND_API}/person/${uuid}`, {
      method: 'DELETE',
      headers: { token: LUXAND_TOKEN },
    }).catch(() => undefined);
    const txt = await photoRes.text();
    throw new Error(`Luxand photo upload failed: ${photoRes.status} ${txt}`);
  }

  return uuid;
}

export async function deleteFaceFromLuxand(uuid: string): Promise<void> {
  await fetch(`${LUXAND_API}/person/${uuid}`, {
    method: 'DELETE',
    headers: { token: LUXAND_TOKEN },
  }).catch(() => undefined);
}
