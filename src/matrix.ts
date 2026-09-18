/**
 * Column-major 4×4 placements, as WebGPU reads them: element (row r, column
 * c) lives at c * 4 + r, so the translation is the last four floats.
 *
 * The renderer turns a normal by the placement itself rather than by its
 * inverse transpose, so a placement that scales differently along different
 * axes would light wrongly. Everything here scales the same all ways.
 */

/** A turn about Z, one scale, and somewhere to put it. */
export function place(out: Float32Array, i: number, x: number, y: number, z: number, yaw = 0, scale = 1) {
  const o = i * 16;
  const c = Math.cos(yaw) * scale,
    s = Math.sin(yaw) * scale;
  out[o] = c;
  out[o + 1] = s;
  out[o + 2] = 0;
  out[o + 3] = 0;
  out[o + 4] = -s;
  out[o + 5] = c;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = 0;
  out[o + 9] = 0;
  out[o + 10] = scale;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}

/**
 * A turn of `angle` about any axis, and somewhere to put it: what a rolling
 * marble needs, since it turns about whatever is across its way and not
 * about Z. The axis is made unit here, so a caller may hand in any length.
 */
export function spin(
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  ax: number,
  ay: number,
  az: number,
  angle: number,
  scale = 1,
) {
  const o = i * 16;
  const l = Math.hypot(ax, ay, az);
  if (l < 1e-9) {
    place(out, i, x, y, z, 0, scale);
    return;
  }
  const ux = ax / l,
    uy = ay / l,
    uz = az / l;
  const c = Math.cos(angle),
    s = Math.sin(angle),
    k = 1 - c;
  // Rodrigues, written straight into the column-major slots
  out[o] = (c + ux * ux * k) * scale;
  out[o + 1] = (uy * ux * k + uz * s) * scale;
  out[o + 2] = (uz * ux * k - uy * s) * scale;
  out[o + 3] = 0;
  out[o + 4] = (ux * uy * k - uz * s) * scale;
  out[o + 5] = (c + uy * uy * k) * scale;
  out[o + 6] = (uz * uy * k + ux * s) * scale;
  out[o + 7] = 0;
  out[o + 8] = (ux * uz * k + uy * s) * scale;
  out[o + 9] = (uy * uz * k - ux * s) * scale;
  out[o + 10] = (c + uz * uz * k) * scale;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}
