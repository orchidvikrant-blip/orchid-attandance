import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native'; // needed for RN environment setup (RNFS mocked)
import * as blazeface from '@tensorflow-models/blazeface';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Employee } from './attendanceService';

let model: blazeface.BlazeFaceModel | null = null;
let ready = false;

export async function initTensorFlow(): Promise<void> {
  if (ready) return;
  await tf.ready();
  model = await blazeface.load();
  ready = true;
}

export function isTfReady(): boolean {
  return ready;
}

// Decode base64 JPEG → tf.Tensor3D using pure-JS jpeg-js
export async function base64ToTensor(base64: string): Promise<tf.Tensor3D | null> {
  try {
    const jpeg = require('jpeg-js');
    const arrayBuffer = decodeBase64(base64);
    const uint8 = new Uint8Array(arrayBuffer);
    const decoded = jpeg.decode(uint8, { useTArray: true });

    // RGBA → RGB tensor [H, W, 3]
    const rgbData = new Uint8Array(decoded.width * decoded.height * 3);
    for (let i = 0; i < decoded.width * decoded.height; i++) {
      rgbData[i * 3]     = decoded.data[i * 4];
      rgbData[i * 3 + 1] = decoded.data[i * 4 + 1];
      rgbData[i * 3 + 2] = decoded.data[i * 4 + 2];
    }

    return tf.tensor3d(rgbData, [decoded.height, decoded.width, 3]);
  } catch (e) {
    console.warn('Image decode error:', e);
    return null;
  }
}

export async function detectFaces(tensor: tf.Tensor3D): Promise<blazeface.NormalizedFace[]> {
  if (!model) return [];
  return model.estimateFaces(tensor, false);
}

// Build a compact descriptor from face landmarks (normalized)
function buildDescriptor(
  face: blazeface.NormalizedFace,
  imgW: number,
  imgH: number
): number[] {
  const [x1, y1] = face.topLeft as [number, number];
  const [x2, y2] = face.bottomRight as [number, number];
  const cx = (x1 + x2) / 2 / imgW;
  const cy = (y1 + y2) / 2 / imgH;
  const w  = (x2 - x1) / imgW;
  const h  = (y2 - y1) / imgH;
  const ar = w / (h || 0.001);

  const lm = (face.landmarks as number[][]) || [];
  const lmNorm = lm.slice(0, 6).flatMap(([lx, ly]) => [lx / imgW, ly / imgH]);

  return [cx, cy, w, h, ar, ...lmNorm];
}

function cosineSim(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

const THRESHOLD = 0.90;

export function matchFace(
  face: blazeface.NormalizedFace,
  employees: Employee[],
  imgW: number,
  imgH: number
): { employee: Employee; score: number } | null {
  const desc = buildDescriptor(face, imgW, imgH);

  let best: Employee | null = null;
  let bestScore = 0;

  for (const emp of employees) {
    if (!emp.faceDescriptor?.length) continue;
    const score = cosineSim(desc, emp.faceDescriptor);
    if (score > bestScore) { bestScore = score; best = emp; }
  }

  return best && bestScore >= THRESHOLD ? { employee: best, score: bestScore } : null;
}

export function descriptorFromFace(
  face: blazeface.NormalizedFace,
  imgW: number,
  imgH: number
): number[] {
  return buildDescriptor(face, imgW, imgH);
}
