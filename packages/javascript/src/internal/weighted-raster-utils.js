import { array, at, integer, record } from "./geometry-b-utils.js";

export const RASTER_LIMIT = 2147483647;
export const UINT32_MAX = 4294967295;

/** Validate and summarize a passive integer mass raster, before any work preflight. */
export function weightedRaster(input, keys, ErrorType) {
  record(ErrorType, input, keys);
  const width = integer(ErrorType, at(ErrorType, input, "width"), 1, 65536);
  const height = integer(ErrorType, at(ErrorType, input, "height"), 1, 65536);
  const size = width * height;
  if (size > RASTER_LIMIT) throw new ErrorType("INVALID_INPUT");
  const weights = array(ErrorType, at(ErrorType, input, "weights"), size);
  let total = 0, active = 0;
  for (let i = 0; i < size; i += 1) {
    const weight = integer(ErrorType, at(ErrorType, weights, i), 0, 65535);
    total += weight;
    if (weight > 0) active += 1;
  }
  return { width, height, size, weights, total, active };
}
