import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as faceapi from '@vladmandic/face-api';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import type { Employee } from './attendanceService';

// Models hosted on jsDelivr CDN — downloaded once at first launch
const MODEL_URL =
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

let ready = false;

export async function initTensorFlow(): Promise<void> {
  if (ready) return;
  await tf.ready();
  // Tiny models — smaller, faster, good enough for kiosk
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
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
  descriptor: Float32Array;          // 128-dim face embedding
  leftEye:  [number, number];        // (x, y) in photo coords
  rightEye: [number, number];
}

// Detect single face + 68 landmarks + 128-dim descriptor
// Returns null if no face found
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

    // Average the 6 eye-corner points for each eye
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

// Euclidean distance between two 128-dim descriptors
function euclidean(a: Float32Array | number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// face-api.js standard: dist < 0.6 = same person
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
