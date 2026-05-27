import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as faceapi from '@vladmandic/face-api';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import type { Employee } from './attendanceService';

// Only the recognition model — detection is done by MLKit (expo-face-detector)
const RECOG = {
  manifest: require('../../assets/models/face_recognition_model-weights_manifest.json'),
  shards: [
    require('../../assets/models/face_recognition_model-shard1.bin'),
    require('../../assets/models/face_recognition_model-shard2.bin'),
  ],
};

async function assetToBuffer(module: number): Promise<ArrayBuffer> {
  const asset = await Asset.fromModule(module).downloadAsync();
  const b64 = await FileSystem.readAsStringAsync(asset.localUri!, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decodeBase64(b64);
}

let ready = false;
export type ProgressFn = (msg: string) => void;

export async function initFaceRecognition(onProgress?: ProgressFn): Promise<void> {
  if (ready) return;
  onProgress?.('Initializing AI...');
  await tf.ready();

  onProgress?.('Loading recognition model...');
  const weightSpecs: tf.io.WeightsManifestEntry[] =
    (RECOG.manifest as any[]).flatMap((g: any) => g.weights);
  const buffers = await Promise.all(RECOG.shards.map(assetToBuffer));
  const totalBytes = buffers.reduce((s, b) => s + b.byteLength, 0);
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buf of buffers) { combined.set(new Uint8Array(buf), offset); offset += buf.byteLength; }
  const weightMap = tf.io.decodeWeights(combined.buffer, weightSpecs);
  (faceapi.nets.faceRecognitionNet as any).loadFromWeightMap(weightMap);

  ready = true;
  onProgress?.('');
}

export function isFaceReady(): boolean { return ready; }

// Crop detected face from photo → compute 128-dim descriptor
export async function computeDescriptor(
  photoUri: string,
  bounds: { x: number; y: number; width: number; height: number }
): Promise<Float32Array | null> {
  try {
    const pad = Math.min(bounds.width, bounds.height) * 0.25;
    const crop = {
      originX: Math.max(0, bounds.x - pad),
      originY: Math.max(0, bounds.y - pad),
      width:   bounds.width  + pad * 2,
      height:  bounds.height + pad * 2,
    };

    const resized = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ crop }, { resize: { width: 160, height: 160 } }],
      { format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (!resized.base64) return null;

    const jpeg = require('jpeg-js');
    const ab   = decodeBase64(resized.base64);
    const raw  = jpeg.decode(new Uint8Array(ab), { useTArray: true });
    const rgba = tf.tensor3d(raw.data, [raw.height, raw.width, 4], 'int32');
    const rgb  = rgba.slice([0, 0, 0], [-1, -1, 3]).cast('float32');
    rgba.dispose();

    const result = await Promise.race([
      (faceapi.nets.faceRecognitionNet as any).computeFaceDescriptor(rgb),
      new Promise<null>(r => setTimeout(() => r(null), 8000)),
    ]);
    rgb.dispose();

    return result as Float32Array | null;
  } catch (e) {
    console.warn('computeDescriptor error:', e);
    return null;
  }
}

const THRESHOLD = 0.55;

export function matchDescriptor(
  descriptor: Float32Array,
  employees: Employee[]
): { employee: Employee; score: number } | null {
  let best: Employee | null = null;
  let bestDist = Infinity;

  for (const emp of employees) {
    const fd = emp.faceDescriptor;
    if (!fd?.length) continue;
    let sum = 0;
    for (let i = 0; i < Math.min(descriptor.length, fd.length); i++) {
      sum += (descriptor[i] - fd[i]) ** 2;
    }
    const dist = Math.sqrt(sum);
    if (dist < bestDist) { bestDist = dist; best = emp; }
  }

  return best && bestDist <= THRESHOLD
    ? { employee: best, score: Math.round((1 - bestDist / THRESHOLD) * 100) }
    : null;
}
