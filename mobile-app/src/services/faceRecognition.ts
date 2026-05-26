import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
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

export function isTfReady(): boolean { return ready; }

// Decode base64 JPEG → RGB tensor
export async function base64ToTensor(base64: string): Promise<tf.Tensor3D | null> {
  try {
    const jpeg = require('jpeg-js');
    const ab  = decodeBase64(base64);
    const raw = jpeg.decode(new Uint8Array(ab), { useTArray: true });

    const rgba = tf.tensor3d(raw.data, [raw.height, raw.width, 4], 'int32');
    const rgb  = rgba.slice([0, 0, 0], [-1, -1, 3]).cast('float32');
    rgba.dispose();
    return rgb as tf.Tensor3D;
  } catch (e) {
    console.warn('Decode error:', e);
    return null;
  }
}

export async function detectFaces(tensor: tf.Tensor3D): Promise<blazeface.NormalizedFace[]> {
  if (!model) return [];
  return model.estimateFaces(tensor, false);
}

// Eye positions from BlazeFace landmarks
export function getEyePositions(face: blazeface.NormalizedFace): { right: [number, number]; left: [number, number] } {
  const lm = face.landmarks as number[][];
  return { right: [lm[0][0], lm[0][1]], left: [lm[1][0], lm[1][1]] };
}

// Extract 48×48 normalized face crop — the REAL visual descriptor
export async function extractDescriptor(
  tensor: tf.Tensor3D,
  face: blazeface.NormalizedFace
): Promise<number[]> {
  const [imgH, imgW] = tensor.shape;
  const [x1, y1] = face.topLeft  as [number, number];
  const [x2, y2] = face.bottomRight as [number, number];

  const pad = 0.30;
  const fw  = x2 - x1, fh = y2 - y1;
  const cx  = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const half = Math.max(fw, fh) * (1 + pad) / 2;

  // Normalized box [y1, x1, y2, x2] in [0,1]
  const box = [
    Math.max(0, (cy - half) / imgH),
    Math.max(0, (cx - half) / imgW),
    Math.min(1, (cy + half) / imgH),
    Math.min(1, (cx + half) / imgW),
  ];

  const boxes   = tf.tensor2d([box]);
  const indices = tf.zeros([1], 'int32');
  const exp     = tensor.div(255).expandDims(0) as tf.Tensor4D;

  const cropped = tf.image.cropAndResize(exp, boxes, indices, [48, 48]);
  const face3d  = cropped.squeeze([0]) as tf.Tensor3D;

  const mean = face3d.mean();
  const std  = face3d.sub(mean).square().mean().sqrt().add(1e-6);
  const norm = face3d.sub(mean).div(std);

  const data = await norm.data();

  [boxes, indices, exp, cropped, face3d, mean, std, norm].forEach(t => t.dispose());
  return Array.from(data);
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

// Pixel-based threshold — tuned for 48×48 normalized patches
const THRESHOLD = 0.72;

export async function matchFace(
  tensor: tf.Tensor3D,
  face: blazeface.NormalizedFace,
  employees: Employee[]
): Promise<{ employee: Employee; score: number } | null> {
  const liveDesc = await extractDescriptor(tensor, face);

  let best: Employee | null = null;
  let bestScore = 0;

  for (const emp of employees) {
    if (!emp.faceDescriptor?.length) continue;
    const score = cosineSim(liveDesc, emp.faceDescriptor);
    if (score > bestScore) { bestScore = score; best = emp; }
  }

  return best && bestScore >= THRESHOLD ? { employee: best, score: bestScore } : null;
}
