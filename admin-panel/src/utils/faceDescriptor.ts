import * as faceapi from '@vladmandic/face-api';

const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

let modelsLoaded = false;

async function ensureModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export async function computeFaceDescriptor(dataUrl: string): Promise<number[]> {
  await ensureModels();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const det = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (!det) { resolve([]); return; }
        resolve(Array.from(det.descriptor));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
