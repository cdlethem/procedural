/** Affine placement of a 640px layer buffer on the 640px studio canvas. */
export type LayerTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export const IDENTITY_LAYER_TRANSFORM: Readonly<LayerTransform> = Object.freeze(
  {
    x: 320,
    y: 320,
    scale: 1,
    rotation: 0,
  },
);

/** Maps a layer-local canvas point to the studio canvas. */
export function transformPoint(
  point: readonly [number, number],
  transform: LayerTransform,
): [number, number] {
  const radians = (transform.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const localX = (point[0] - 320) * transform.scale;
  const localY = (point[1] - 320) * transform.scale;
  return [
    transform.x + localX * cosine - localY * sine,
    transform.y + localX * sine + localY * cosine,
  ];
}

/** Maps a studio canvas point back to the layer-local canvas. */
export function inverseTransformPoint(
  point: readonly [number, number],
  transform: LayerTransform,
): [number, number] {
  const radians = (transform.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const translatedX = point[0] - transform.x;
  const translatedY = point[1] - transform.y;
  return [
    (translatedX * cosine + translatedY * sine) / transform.scale + 320,
    (-translatedX * sine + translatedY * cosine) / transform.scale + 320,
  ];
}
