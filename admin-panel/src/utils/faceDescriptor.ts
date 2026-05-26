import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

let model: blazeface.BlazeFaceModel | null = null;

async function ensureModel() {
  if (!model) {
    await tf.ready();
    model = await blazeface.load();
  }
}

function imgToTensor(img: HTMLImageElement): tf.Tensor3D {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

  const rgba = tf.tensor3d(Array.from(data), [height, width, 4], 'int32');
  const rgb  = rgba.slice([0, 0, 0], [-1, -1, 3]).cast('float32');
  rgba.dispose();
  return rgb as tf.Tensor3D;
}

function cropDescriptor(tensor: tf.Tensor3D, face: blazeface.NormalizedFace): tf.Tensor1D {
  const [imgH, imgW] = tensor.shape;
  const [x1, y1] = face.topLeft  as [number, number];
  const [x2, y2] = face.bottomRight as [number, number];

  const pad  = 0.30;
  const cx   = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const half = Math.max(x2 - x1, y2 - y1) * (1 + pad) / 2;

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
  const flat = norm.flatten();

  [boxes, indices, exp, cropped, face3d, mean, std, norm].forEach(t => t.dispose());
  return flat as tf.Tensor1D;
}

export async function computeFaceDescriptor(dataUrl: string): Promise<number[]> {
  await ensureModel();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const tensor = imgToTensor(img);
      try {
        const faces = await model!.estimateFaces(tensor, false);
        if (faces.length === 0) {
          tensor.dispose();
          resolve([]);
          return;
        }
        const flatTensor = cropDescriptor(tensor, faces[0]);
        const data = await flatTensor.data();
        flatTensor.dispose();
        tensor.dispose();
        resolve(Array.from(data));
      } catch (e) {
        tensor.dispose();
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
