import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as faceapi from '@vladmandic/face-api';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import type { Employee } from './attendanceService';

// ─── Bundled asset references (compiled into APK — no internet needed) ────────
const ASSETS = {
  tinyFace: {
    manifest: require('../../assets/models/tiny_face_detector_model-weights_manifest.json'),
    shards:   [require('../../assets/models/tiny_face_detector_model-shard1.bin')],
  },
  landmark: {
    manifest: require('../../assets/models/face_landmark_68_tiny_model-weights_manifest.json'),
    shards:   [require('../../assets/models/face_landmark_68_tiny_model-shard1.bin')],
  },
  recognition: {
    manifest: require('../../assets/models/face_recognition_model-weights_manifest.json'),
    shards:   [
      require('../../assets/models/face_recognition_model-shard1.bin'),
      require('../../assets/models/face_recognition_model-shard2.bin'),
    ],
  },
};

// Read a bundled asset as an ArrayBuffer
async function assetToBuffer(module: number): Promise<ArrayBuffer> {
  const asset = await Asset.fromModule(module).downloadAsync();
  const b64   = await FileSystem.readAsStringAsync(asset.localUri!, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decodeBase64(b64);
}

// Load a face-api.js network from bundled assets using tf.io
async function loadNet(net: any, manifestObj: any, shardModules: number[], onProgress?: ProgressFn, label?: string) {
  onProgress?.(`${label}: reading files...`);
  const weightSpecs: tf.io.WeightsManifestEntry[] =
    (manifestObj as any[]).flatMap((g: any) => g.weights);

  const buffers = await Promise.all(shardModules.map(assetToBuffer));

  onProgress?.(`${label}: decoding weights...`);
  const totalBytes = buffers.reduce((s, b) => s + b.byteLength, 0);
  const combined   = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buf of buffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  const weightMap = tf.io.decodeWeights(combined.buffer, weightSpecs);
  onProgress?.(`${label}: loading params...`);
  (net as any).loadFromWeightMap(weightMap);
}

// ─── Public API ───────────────────────────────────────────────────────────────

let ready = false;
export type ProgressFn = (msg: string) => void;

export async function initTensorFlow(onProgress?: ProgressFn): Promise<void> {
  if (ready) return;
  await tf.ready();

  await loadNet(faceapi.nets.tinyFaceDetector, ASSETS.tinyFace.manifest, ASSETS.tinyFace.shards, onProgress, 'Detector');
  await loadNet(faceapi.nets.faceLandmark68TinyNet, ASSETS.landmark.manifest, ASSETS.landmark.shards, onProgress, 'Landmark');
  await loadNet(faceapi.nets.faceRecognitionNet, ASSETS.recognition.manifest, ASSETS.recognition.shards, onProgress, 'Recognition');

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
    const rgb  = rgba.slice([0, 0, 0], [-1, -1, 3]).cast('float32');
    rgba.dispose();
    return rgb as tf.Tensor3D;
  } catch (e) {
    console.warn('JPEG decode error:', e);
    return null;
  }
}

export interface FaceDetection {
  descriptor: Float32Array;
  leftEye:    [number, number];
  rightEye:   [number, number];
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
      leftEye:    avgPt(det.landmarks.getLeftEye()),
      rightEye:   avgPt(det.landmarks.getRightEye()),
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
