/*
 * The three implicit surfaces of Quinn's rig — the body column (torso, neck,
 * head and tail as one smooth union) and the two crest plumes — meshed with
 * surface nets. This is the expensive part of building the model (millions
 * of field samples), so it runs in surfaces.worker.ts and stays free of
 * three.js: plain typed arrays in, plain typed arrays out.
 */

export type Row = number[];
export interface Grid { u0: number; y0: number; h: number; nu: number; ny: number; b64: string }
export interface SurfaceInput { body: Row[]; tail: Row[]; crestGrids: Record<"F" | "Fs", Grid> }
export interface SurfaceMesh { position: Float32Array; normal: Float32Array; index: Uint32Array }
export interface Surfaces { body: SurfaceMesh; crest: SurfaceMesh; crestSmall: SurfaceMesh }
type Field = (x: number, y: number, z: number) => number;

// Rows are sampled every 0.01 in y: [y, hw, zb, zf]. Interpolate columns 1–3 into `out`.
function rowsAt(R: Row[], y: number, out: number[]) {
  let i = Math.min(R.length - 2, Math.max(0, Math.floor((y - R[0][0]) / 0.01)));
  while (i < R.length - 2 && R[i + 1][0] < y) i++; while (i > 0 && R[i][0] > y) i--;
  const a = R[i], b = R[i + 1], t = (y - a[0]) / (b[0] - a[0]);
  out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; out[3] = a[3] + (b[3] - a[3]) * t;
  return out;
}
function ellField(x: number, z: number, hw: number, zb: number, zf: number) {
  const c = (zb + zf) / 2, d = Math.max((zf - zb) / 2, 0.003), h = Math.max(hw, 0.003);
  return (Math.hypot(x / h, (z - c) / d) - 1) * Math.min(h, d);
}
function smin(a: number, b: number, k: number) { const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); }
const scratch = [0, 0, 0, 0];
function fieldRows(R: Row[], x: number, y: number, z: number, minHw: number) {
  const y0 = R[0][0], y1 = R[R.length - 1][0]; const yc = Math.min(y1, Math.max(y0, y)); const r = rowsAt(R, yc, scratch);
  const f = ellField(x, z, Math.max(r[1], minHw), r[2], r[3]), dy = Math.abs(y - yc);
  return dy > 0 ? Math.hypot(Math.max(f, 0), dy) : f;
}

function buildSurface(field: Field, [x0, x1, y0, y1, z0, z1]: number[], h: number): SurfaceMesh {
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const F = new Float32Array(nx * ny * nz); const I = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) { const y = y0 + j * h, z = z0 + k * h;
    for (let i = 0; i < nx; i++) F[I(i, j, k)] = field(x0 + i * h, y, z); }
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1); const C = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = []; const E = [[0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0; for (let c = 0; c < 8; c++) if (F[I(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))] < 0) neg++;
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const e of E) { const a = F[I(i + e[0], j + e[1], k + e[2])], b = F[I(i + e[3], j + e[4], k + e[5])];
      if ((a < 0) !== (b < 0)) { const t = a / (a - b); sx += e[0] + (e[3] - e[0]) * t; sy += e[1] + (e[4] - e[1]) * t; sz += e[2] + (e[5] - e[2]) * t; cnt++; } }
    cell[C(i, j, k)] = pos.length / 3; pos.push(x0 + (i + sx / cnt) * h, y0 + (j + sy / cnt) * h, z0 + (k + sz / cnt) * h);
  }
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const f0 = F[I(i, j, k)] < 0;
    if (f0 !== (F[I(i + 1, j, k)] < 0)) quad(cell[C(i, j - 1, k - 1)], cell[C(i, j, k - 1)], cell[C(i, j, k)], cell[C(i, j - 1, k)], f0);
    if (f0 !== (F[I(i, j + 1, k)] < 0)) quad(cell[C(i - 1, j, k - 1)], cell[C(i - 1, j, k)], cell[C(i, j, k)], cell[C(i, j, k - 1)], f0);
    if (f0 !== (F[I(i, j, k + 1)] < 0)) quad(cell[C(i - 1, j - 1, k)], cell[C(i, j - 1, k)], cell[C(i, j, k)], cell[C(i - 1, j, k)], f0);
  }
  // relax vertices slightly onto a smoother surface, then take normals from the field gradient
  const nv = pos.length / 3, nb = Array.from({ length: nv }, () => new Set<number>());
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b); }
  let P = Float32Array.from(pos);
  for (let it = 0; it < 2; it++) { const Q = new Float32Array(P.length);
    for (let v = 0; v < nv; v++) { let ax = 0, ay = 0, az = 0; for (const u of nb[v]) { ax += P[u * 3]; ay += P[u * 3 + 1]; az += P[u * 3 + 2]; } const m = nb[v].size || 1;
      Q[v * 3] = P[v * 3] * 0.5 + ax / m * 0.5; Q[v * 3 + 1] = P[v * 3 + 1] * 0.5 + ay / m * 0.5; Q[v * 3 + 2] = P[v * 3 + 2] * 0.5 + az / m * 0.5; }
    // project back onto the surface along the gradient
    for (let v = 0; v < nv; v++) { for (let s = 0; s < 2; s++) { const x = Q[v * 3], y = Q[v * 3 + 1], z = Q[v * 3 + 2], e = 0.004;
      const f = field(x, y, z), gx = (field(x + e, y, z) - field(x - e, y, z)) / (2 * e), gy = (field(x, y + e, z) - field(x, y - e, z)) / (2 * e), gz = (field(x, y, z + e) - field(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz; if (g2 < 0.05) continue; const st = Math.max(-0.01, Math.min(0.01, f / g2)); Q[v * 3] -= st * gx; Q[v * 3 + 1] -= st * gy; Q[v * 3 + 2] -= st * gz; } }
    P = Q; }
  const nrm = new Float32Array(P.length);
  for (let v = 0; v < nv; v++) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], e = 0.006;
    const gx = field(x + e, y, z) - field(x - e, y, z), gy = field(x, y + e, z) - field(x, y - e, z), gz = field(x, y, z + e) - field(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l; nrm[v * 3 + 1] = gy / l; nrm[v * 3 + 2] = gz / l; }
  // consistent winding: face normal must agree with the field gradient
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const abx = P[b * 3] - P[a * 3], aby = P[b * 3 + 1] - P[a * 3 + 1], abz = P[b * 3 + 2] - P[a * 3 + 2];
    const acx = P[c * 3] - P[a * 3], acy = P[c * 3 + 1] - P[a * 3 + 1], acz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = aby * acz - abz * acy, fy = abz * acx - abx * acz, fz = abx * acy - aby * acx;
    if (fx * nrm[a * 3] + fy * nrm[a * 3 + 1] + fz * nrm[a * 3 + 2] < 0) { idx[t + 1] = c; idx[t + 2] = b; } }
  return { position: P, normal: nrm, index: Uint32Array.from(idx) };
}

// Crest outlines are signed-distance grids (int16 × 1e-4, base64) traced from the sheet's front view.
function grid(G: Grid) {
  const bin = atob(G.b64), a = new Int16Array(bin.length / 2);
  for (let i = 0; i < a.length; i++) { const lo = bin.charCodeAt(2 * i), hi = bin.charCodeAt(2 * i + 1); let v = lo | (hi << 8); if (v > 32767) v -= 65536; a[i] = v; }
  return (u: number, y: number) => { const fu = (u - G.u0) / G.h, fy = (y - G.y0) / G.h; if (fu < 0 || fy < 0 || fu > G.nu - 1.001 || fy > G.ny - 1.001) return 0.2;
    const i = Math.floor(fu), j = Math.floor(fy), tu = fu - i, ty = fy - j, k = j * G.nu + i;
    const v = (a[k] * (1 - tu) + a[k + 1] * tu) * (1 - ty) + (a[k + G.nu] * (1 - tu) + a[k + G.nu + 1] * tu) * ty; return v / 10000; };
}

export function buildSurfaces(D: SurfaceInput): Surfaces {
  const bodyField: Field = (x, y, z) => smin(fieldRows(D.body, x, y, z, 0), fieldRows(D.tail, x, y, z, 0.04), 0.07);
  // Inflated plumes: the front-view outline puffed out into a rounded, pebble-like solid. Thickness follows
  // sqrt(depth inside the outline), so every edge rolls over smoothly with no ridges or corners.
  const ZC = [0.60, 0.615, 0.625, 0.63, 0.628, 0.622, 0.615, 0.608, 0.60, 0.596, 0.592, 0.589, 0.586, 0.584, 0.583, 0.582, 0.581, 0.581, 0.581, 0.581, 0.582, 0.583, 0.584, 0.585, 0.586, 0.587];
  const zcAt = (y: number) => { const t = Math.min(ZC.length - 1.001, Math.max(0, (y - 2.52) / 0.02)); const k = Math.floor(t); return ZC[k] + (ZC[k + 1] - ZC[k]) * (t - k); };
  const inflate = (F2: (u: number, y: number) => number, zc: (y: number) => number, T: number, Dm: number): Field => (x, y, z) => {
    const f = F2(x, y); const th = f < 0 ? T * Math.sqrt(Math.min(1, -f / Dm)) : -f;
    return Math.abs(z - zc(y)) - th; };
  return {
    body: buildSurface(bodyField, [-0.72, 0.72, 0.33, 2.72, -0.82, 1.02], 0.0125),
    crest: buildSurface(inflate(grid(D.crestGrids.F), zcAt, 0.115, 0.14), [-0.36, 0.36, 2.45, 3.12, 0.4, 0.8], 0.005),
    crestSmall: buildSurface(inflate(grid(D.crestGrids.Fs), () => 0.605, 0.05, 0.054), [-0.2, 0.2, 2.45, 2.85, 0.5, 0.72], 0.0035),
  };
}
