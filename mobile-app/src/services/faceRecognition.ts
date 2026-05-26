import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as faceapi from '@vladmandic/face-api';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import type { Employee } from './attendanceService';

const CDN = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/';
const CACHE_DIR = `${FileSystem.documentDirectory}facemodels/`;

let ready = false;
let fetchPatched = false;

// Intercept CDN fetch calls → serve from local cache (download if needed)
async function patchFetch() {
  if (fetchPatched) return;
  fetchPatched = true;
  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });

  const _orig = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (!url.startsWith(CDN)) return _orig(input, init);

    const filename = url.split('/').pop()!;
    const local    = CACHE_DIR + filename;
    const info     = await FileSystem.getInfoAsync(local);

    if (!info.exists) {
      // First time: download from CDN and cache locally
      await FileSystem.downloadAsync(url, local);
    }

    // Serve from local file
    if (filename.endsWith('.json')) {
      const text = await FileSystem.readAsStringAsync(local);
      return new Response(text, { headers: { 'Content-Type': 'application/json' } });
    } else {
      const b64 = await FileSystem.readAsStringAsync(local, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return new Response(decodeBase64(b64), {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }
  };
}

export type ProgressFn = (msg: string) => void;

export async function initTensorFlow(onProgress?: ProgressFn): Promise<void> {
  if (ready) return;
  await tf.ready();
  await patchFetch();

  onProgress?.('Loading face detector...');
  await faceapi.nets.tinyFaceDetector.loadFromUri(CDN);

  onProgress?.('Loading landmark model...');
  await faceapi.nets.faceLandmark68TinyNet.loadFromUri(CDN);

  onProgress?.('Loading recognition model...');
  await faceapi.nets.faceRecognitionNet.loadFromUri(CDN);

  ready = true;
}

export function isTfReady(): boolean { return ready; }

// Decode base64 JPEG → RGB int32 tensor [H, W, 3]
export async function base64ToTensor(base64: string): Promise<tf.Tensor3D | null> {
  try {
    const jpeg = require('jpeg-js');
    const ab   = decodeBase64(base64);
    const raw  = jpeg.decode(new Uint8Array(ab), { useTArray: true });
    const rgba = tf.tensor3d(raw.data, [raw.height, raw.width, 4], 'int32');
    const rgb  = rgba.slice([0, 0, 0], [-1, -1, 3]).cast('int32');
    rgba.dispose();
    return rgb as tf.Tensor3D;
  } catch (e) {
    console.warn('JPEG decode error:', e);
    return null;
  }
}

export interface FaceDetection {
  descriptor: Float32Array;
  leftEye:  [number, number];
  rightEye: [number, number];
}

export async function detectFace(tensor: tf.Tensor3D): Promise<FaceDetection | null> {
  try {
    const det = await faceapi
      .detectSingleFace(
        tensor as unknown as HTMLCanvasElement,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })
      )
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!det) return null;

    const avgPt = (pts: faceapi.Point[]): [number, number] => [
      pts.reduce((s, p) => s + p.x, 0) / pts.length,
      pts.reduce((s, p) => s + p.y, 0) / pts.length,
    ];

    return {
      descriptor: det.descriptor,
      leftEye:  avgPt(det.landmarks.getLeftEye()),
      rightEye: avgPt(det.landmarks.getRightEye()),
    };
  } catch (e) {
    console.warn('Face detection error:', e);
    return null;
  }
}

function euclidean(a: Float32Array | number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

const THRESHOLD = 0.6;

export function matchDescriptor(
  descriptor: Float32Array,
  employees: Employee[]
): { employee: Employee; score: number } | null {
  let best: Employee | null = null;
  let bestDist = Infinity;

  for (const emp of employees) {
    if (!emp.faceDescriptor?.length) continue;
    const dist = euclidean(descriptor, emp.faceDescriptor);
    if (dist < bestDist) { bestDist = dist; best = emp; }
  }

  return best && bestDist <= THRESHOLD
    ? { employee: best, score: Math.round((1 - bestDist / THRESHOLD) * 100) }
    : null;
}
