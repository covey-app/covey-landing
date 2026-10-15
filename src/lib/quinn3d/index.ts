/*
 * Quinn in 3D — the rigged model built from the turnaround sheet
 * (ported from "Quinn in 3D", the standalone turntable). Shapes are traced
 * from the sheet's silhouettes and the artwork is projected back onto them
 * from the four orthographic drawings, so every angle in between the drawn
 * views is real geometry instead of a swapped image.
 *
 * Rig data and textures live in /brand/quinn/3d/ and load only when a page
 * mounts the model; three.js comes in with this module as its own chunk, and
 * the heavy meshing runs in a worker (surfaces.ts) so the page never stalls.
 *
 *   const q = await mountQuinn3D(host, { reducedMotion });
 *   q.greet();        // a full turn and a flap
 *   q.hello();        // a flap and a hop
 *   q.setTurn(a);     // face angle `a` (radians; scroll-driven turns)
 *   q.destroy();
 *
 * The canvas overhangs `host` (the box the 2D poster fills) so wings, hops
 * and side views never clip, and the model is framed so that, facing front,
 * it covers the poster: feet on the host's bottom edge, crest at its top.
 * The overhang ignores the pointer; dragging starts on the host itself, so
 * nothing beside Quinn is ever covered. Global CSS (data-quinn3d) fades the
 * canvas in over the poster.
 * Rendering stops while the canvas is off screen or the tab is hidden; under
 * reduced motion nothing moves unless the visitor drags (and Quinn stays
 * wherever they leave him). Rejects (and leaves
 * the page untouched) when there's no WebGL 2.
 */
import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RGBADepthPacking,
  Scene,
  ShadowMaterial,
  Shape,
  Skeleton,
  SkinnedMesh,
  SplineCurve,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TubeGeometry,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
  DoubleSide,
  type IUniform,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Row, SurfaceInput, SurfaceMesh, Surfaces } from "./surfaces";

const BASE = "/brand/quinn/3d/";

interface ViewData { c: string; m: string; W: number; H: number; origin: number; ground: number }
interface RigData {
  S: number;
  crestGrids: SurfaceInput["crestGrids"];
  body: Row[]; legs: Row[]; foot: Row[]; tail: Row[]; beak: Row[];
  wing: Record<"L" | "R", [number, number][]>;
  views: Record<ViewName, ViewData>;
}
type ViewName = "front" | "right" | "back" | "left";
interface Section { c: Vector3; u: Vector3; v: Vector3; ru: number; rv: number; n?: number }

export interface Quinn3D {
  /** Full turn and a flap — the first-visit greeting. */
  greet(): void;
  /** A flap and a hop. */
  hello(): void;
  /**
   * The angle Quinn rests at (0 = facing the viewer, π/2 = his right side).
   * He eases toward it, and returns to it after a drag. Unbounded, so a
   * scroll from 0 to 2π is one full turn.
   */
  setTurn(angle: number): void;
  destroy(): void;
}

// How far the canvas overhangs the host, as fractions of the host's size.
const PAD = { x: 0.6, top: 0.12, bottom: 0.06 };

export interface MountOptions {
  reducedMotion: boolean;
  /** Turn the head toward the pointer (fine pointers, motion allowed). Default true. */
  follow?: boolean;
  /** Starting angle, as for setTurn. */
  turn?: number;
}

export async function mountQuinn3D(host: HTMLElement, opts: MountOptions): Promise<Quinn3D> {
  const reduceMotion = opts.reducedMotion;
  const D: RigData = await fetch(BASE + "rig.json").then((r) => {
    if (!r.ok) throw new Error(`quinn3d: rig ${r.status}`);
    return r.json();
  });
  // Mesh the body and crest in a worker while the textures download.
  const surfaces = new Promise<Surfaces>((resolve, reject) => {
    const w = new Worker(new URL("./surfaces.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<Surfaces>) => { resolve(e.data); w.terminate(); };
    w.onerror = (e) => { reject(new Error(`quinn3d: worker ${e.message}`)); w.terminate(); };
    w.postMessage({ body: D.body, tail: D.tail, crestGrids: { F: D.crestGrids.F, Fs: D.crestGrids.Fs } } satisfies SurfaceInput);
  });
  const VIEWS: ViewName[] = ["front", "right", "back", "left"];
  const loader = new TextureLoader();
  const load = (f: string) => loader.loadAsync(BASE + f);
  const [colorTex, markTex, S] = await Promise.all([
    Promise.all(VIEWS.map((n) => load(D.views[n].c))),
    Promise.all(VIEWS.map((n) => load(D.views[n].m))),
    surfaces,
  ]);
  colorTex.forEach((t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = 8; });
  markTex.forEach((t) => { t.anisotropy = 8; });   // solid-marking + ink distance fields

  const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

  // ---------------- renderer / scene ----------------
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });   // throws without WebGL 2
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "quinn-3d";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    left: `${-PAD.x * 100}%`, right: `${-PAD.x * 100}%`,
    top: `${-PAD.top * 100}%`, bottom: `${-PAD.bottom * 100}%`,
    width: `${(1 + 2 * PAD.x) * 100}%`, height: `${(1 + PAD.top + PAD.bottom) * 100}%`,
    pointerEvents: "none",
  });
  const scene = new Scene();
  const camera = new PerspectiveCamera(18, 1, 0.1, 100);

  const hemi = new HemisphereLight(0xffffff, 0xd9d2e3, 0.6); scene.add(hemi);
  const key = new DirectionalLight(0xffffff, 0.6);
  key.position.set(2, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.2); fill.position.set(-5, 3, -4); scene.add(fill);

  // ---------------- projection painting ----------------
  // Each part is painted by projecting the four orthographic drawings of the sheet back onto it,
  // using rest-pose coordinates so the artwork stays on the part while it animates.
  const SH: Record<string, IUniform> = {
    uImg0: { value: colorTex[0] }, uImg1: { value: colorTex[1] }, uImg2: { value: colorTex[2] }, uImg3: { value: colorTex[3] },
    uDep0: { value: null }, uDep1: { value: null }, uDep2: { value: null }, uDep3: { value: null },
    uMsk0: { value: markTex[0] }, uMsk1: { value: markTex[1] }, uMsk2: { value: markTex[2] }, uMsk3: { value: markTex[3] },
    uView: { value: VIEWS.map((n) => new Vector4(D.views[n].origin, D.views[n].ground, D.views[n].W, D.views[n].H)) },
    uZOut: { value: [0.6199, 0.6172, 0.5982, 0.5504, 0.4926, 0.4431, 0.4035, 0.3721, 0.3497, 0.3360, 0.3292, 0.3273, 0.3306, 0.3390, 0.3493, 0.3580, 0.3656, 0.3718, 0.3763, 0.3795, 0.3807, 0.3801, 0.3781, 0.3750, 0.3700, 0.3640, 0.3611, 0.3900, 0.4600, 0.5600, 0.7000, 0.8000, 0.8000] },
    uS: { value: D.S }, uFlat: { value: 0.75 }, uLine: { value: 0 },
  };
  const GLSL = `
uniform sampler2D uImg0, uImg1, uImg2, uImg3, uDep0, uDep1, uDep2, uDep3, uMsk0, uMsk1, uMsk2, uMsk3;
uniform vec4 uView[4]; uniform float uS, uFlat, uLine;
varying vec3 vRest; varying vec3 vRestN;
vec2 projUV(int k, float u, float y){ vec4 v=uView[k]; return vec2((v.x + u*uS)/v.z, 1.0 - (v.y - y*uS)/v.w); }
float vis(sampler2D dep, vec2 uv, float dist){
  if (uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) return 0.0;
  float dn = (dist-5.0)/10.0; vec2 px = 0.75/vec2(textureSize(dep,0));
  float v = 0.0;
  v += step(dn, unpackRGBAToDepth(texture2D(dep, uv)) + 0.0025);
  v += step(dn, unpackRGBAToDepth(texture2D(dep, uv+vec2(px.x,0.))) + 0.0025);
  v += step(dn, unpackRGBAToDepth(texture2D(dep, uv-vec2(px.x,0.))) + 0.0025);
  v += step(dn, unpackRGBAToDepth(texture2D(dep, uv+vec2(0.,px.y))) + 0.0025);
  v += step(dn, unpackRGBAToDepth(texture2D(dep, uv-vec2(0.,px.y))) + 0.0025);
  return v/5.0;
}
vec3 paint(vec3 p, vec3 n, float useVis){
  vec2 uv0 = projUV(0, p.x, p.y), uv1 = projUV(1, p.z, p.y), uv2 = projUV(2, -p.x, p.y), uv3 = projUV(3, -p.z, p.y);
  vec4 f = vec4(max(n.z,0.0), max(-n.x,0.0), max(-n.z,0.0), max(n.x,0.0));
  f = pow(f, vec4(14.0)) + 0.0002;
  vec4 vv = useVis > 0.5 ? vec4(vis(uDep0,uv0,10.0-p.z), vis(uDep1,uv1,p.x+10.0), vis(uDep2,uv2,p.z+10.0), vis(uDep3,uv3,10.0-p.x)) : vec4(1.0);
  vec4 w = f*vv; float sw = dot(w, vec4(1.0)) + 1e-5; float sf = dot(f, vec4(1.0)) + 1e-5;
  vec3 sharp = (texture2D(uImg0,uv0).rgb*w.x + texture2D(uImg1,uv1).rgb*w.y + texture2D(uImg2,uv2).rgb*w.z + texture2D(uImg3,uv3).rgb*w.w) / sw;
  // where no view sees this spot cleanly, fall back to a soft blend of the nearby artwork instead of streaks
  vec3 soft = (textureLod(uImg0,uv0,4.5).rgb*f.x + textureLod(uImg1,uv1,4.5).rgb*f.y + textureLod(uImg2,uv2,4.5).rgb*f.z + textureLod(uImg3,uv3,4.5).rgb*f.w) / sf;
  return mix(soft, sharp, smoothstep(0.1, 0.6, sw/sf));
}
// Solid markings and ink come from distance fields of each view. The front/back field and the side field are
// blended by how squarely the surface faces each view, then thresholded once, so every marking has a single
// crisp edge that slides smoothly between where the front and side drawings put it.
uniform float uZOut[33];
float zOutAt(float y){ float t=clamp((y-1.30)/0.03, 0.0, 32.0); int i=int(floor(t)); int j=min(i+1,32); return mix(uZOut[i], uZOut[j], t-float(i)); }
vec3 marks(vec3 p, vec3 n){
  vec2 uv0 = projUV(0, p.x, p.y), uv1 = projUV(1, p.z, p.y), uv2 = projUV(2, -p.x, p.y), uv3 = projUV(3, -p.z, p.y);
  vec3 mF = mix(texture2D(uMsk2,uv2).rgb, texture2D(uMsk0,uv0).rgb, smoothstep(-0.3,0.3,n.z));
  vec3 mS = mix(texture2D(uMsk1,uv1).rgb, texture2D(uMsk3,uv3).rgb, smoothstep(-0.03,0.03,p.x));
  float a = abs(n.z), b = abs(n.x); float wS = b*b/(a*a+b*b+1e-4);
  float hd = smoothstep(1.98, 2.08, p.y);   // on the head the side drawing carries the band around
  vec3 m = mix(mF, mS, mix(smoothstep(0.08, 0.92, wS), smoothstep(0.0, 0.35, wS), hd));
  // Collar: one continuous U. Its shape comes from the front drawing alone (face outline + chest line),
  // and it wraps back around the neck only as far as the side drawing's crescent reaches.
  float zone = smoothstep(1.26, 1.34, p.y) * (1.0 - smoothstep(2.19, 2.25, p.y)) * smoothstep(0.12, 0.2, p.z);
  float ca = texture2D(uMsk0, uv0).r, cb = 0.5 + (p.z - zOutAt(p.y)) * 8.23;
  float hk = clamp(0.5 + 0.5*(cb-ca)/0.9, 0.0, 1.0); float collar = mix(cb, ca, hk) - 0.9*hk*(1.0-hk) + 0.06;  // rounded corner
  m.r = mix(m.r, collar, zone);
  // Headband: one flat ribbon around the skull on a tilted plane (high at the brow, low at the nape),
  // fitted to the front, side and back drawings.
  float fz = 2.1205 + 0.4828*p.z + 0.5354*p.z*p.z, fd = 0.4828 + 1.0708*p.z;
  float bd = (p.y - fz) / sqrt(1.0 + fd*fd);
  float band = 0.5 + (0.031 - abs(bd)) * 8.23;
  float hw = smoothstep(1.96, 2.03, p.y);
  m.r = mix(m.r, max(collar*zone, band), hw);
  return m;
}
float crisp(float v){ float w = max(fwidth(v)*0.8, 0.002); return smoothstep(0.5-w, 0.5+w, v); }
float stroke(float v, float px){ float w = max(fwidth(v), 1e-4); return 1.0 - smoothstep(px-0.6, px+0.6, abs(v-0.5)/w); }
`;
  // opts.lo / opts.hi clamp where a part samples the artwork (so parts hidden inside the body at rest
  // carry their own art when they swing out); opts.wing paints both faces of a wing with its outer art.
  interface PaintOpts { lo?: Vector3; hi?: Vector3; wing?: number; thin?: boolean; sole?: boolean; noMarks?: boolean }
  function painted(o: PaintOpts = {}) {
    const m = new MeshStandardMaterial({ roughness: 1.0, metalness: 0 });
    m.userData.uRest = { value: new Matrix4() };
    const U = { uLo: { value: o.lo || V(-9, -9, -9) }, uHi: { value: o.hi || V(9, 9, 9) }, uWing: { value: o.wing || 0 },
      uThin: { value: o.thin ? 1 : 0 }, uSole: { value: o.sole ? 1 : 0 }, uNoMk: { value: o.noMarks ? 1 : 0 } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, SH, U); sh.uniforms.uRest = m.userData.uRest;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 uRest; varying vec3 vRest; varying vec3 vRestN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = (uRest*vec4(position,1.0)).xyz; vRestN = normalize(mat3(uRest)*normal);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <packing>", "#include <packing>\nuniform vec3 uLo, uHi; uniform float uWing, uThin, uSole, uNoMk;\n" + GLSL)
        .replace("#include <color_fragment>", `vec3 nn = normalize(vRestN); float useVis = 1.0;
        if (uWing != 0.0) { nn = vec3(uWing, 0.0, 0.0); useVis = 0.0; }
        vec3 cp = clamp(vRest, uLo, uHi);
        vec3 grad = paint(cp, normalize(nn), useVis);
        vec3 mk = (uWing != 0.0 || uNoMk > 0.5) ? vec3(0.0) : marks(cp, normalize(nn));
        if (uSole > 0.5) {
          // sneakers: toe cap and ankle cuff as exact shapes (side view semicircle + cuff band)
          float toe = min(1.0 - pow((vRest.z-0.47)/0.30,2.0) - pow((vRest.y-0.12)/0.145,2.0), (vRest.y-0.097)*8.0);
          float cuff = min(vRest.y-0.226, 0.305-vRest.y)*8.0;
          mk = vec3(0.5 + 0.25*max(toe, cuff), 0.0, 0.0);
        }
        float W = crisp(mk.r), K = crisp(mk.g);
        vec3 colC = mix(mix(grad, vec3(0.92), W), vec3(0.018,0.016,0.014), K);
        float ln = max(stroke(mk.r, 1.1), K);
        if (uThin > 0.5) ln = max(ln, smoothstep(0.35, 0.7, mk.b));
        if (uSole > 0.5) { float d = abs(vRest.y-0.105); ln = max(ln, 1.0 - smoothstep(0.6, 1.6, d/max(fwidth(vRest.y),1e-4))); }
        vec3 colL = mix(vec3(0.86), vec3(0.018,0.016,0.014), ln);
        diffuseColor.rgb = mix(colC, colL, uLine);`)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uFlat;");
    };
    return m;
  }
  const matBeak = new MeshStandardMaterial({ color: 0x2a2824, roughness: 0.55 });

  // ---------------- geometry helpers ----------------
  function sePt(a: number, n: number) { const c = Math.cos(a), s = Math.sin(a); return [Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]; }
  // Loft rings along a path.
  function loft(sections: Section[], radial = 96) {
    const pos: number[] = [], idx: number[] = [];
    for (const s of sections) for (let j = 0; j <= radial; j++) {
      const [a, b] = sePt(j / radial * Math.PI * 2, s.n || 2);
      const p = s.c.clone().addScaledVector(s.u, a * s.ru).addScaledVector(s.v, b * s.rv); pos.push(p.x, p.y, p.z);
    }
    const m = Math.floor(sections.length / 2), s0 = sections[Math.max(0, m - 1)], s1 = sections[m];
    const flip = s1.c.clone().sub(s0.c).cross(s1.v).dot(s1.u) < 0;
    for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.computeVertexNormals(); return g;
  }
  const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
  // body rows [y, hw, zb, zf]
  function rowsAt(R: Row[], y: number): Row {
    let i = Math.min(R.length - 2, Math.max(0, Math.floor((y - R[0][0]) / 0.01)));
    while (i < R.length - 2 && R[i + 1][0] < y) i++; while (i > 0 && R[i][0] > y) i--;
    const a = R[i], b = R[i + 1], t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => v + (b[k] - v) * t);
  }
  function bodyAt(y: number) {
    const R = D.body; if (y <= R[0][0]) return R[0]; if (y >= R[R.length - 1][0]) return R[R.length - 1];
    return rowsAt(R, y);
  }
  const NB = 2.0;
  // x of the body surface at (y,z) on the +x side
  function surfX(y: number, z: number) { const [, hw, zb, zf] = bodyAt(y); const c = (zb + zf) / 2, d = (zf - zb) / 2; const q = Math.min(1, Math.abs((z - c) / d)); return hw * Math.pow(Math.max(0, 1 - Math.pow(q, NB)), 1 / NB); }

  function fromMesh(m: SurfaceMesh) {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(m.position, 3)); g.setAttribute("normal", new BufferAttribute(m.normal, 3)); g.setIndex(new BufferAttribute(m.index, 1));
    return g;
  }

  // ---------------- rig ----------------
  const root = new Group(); scene.add(root);
  const J: Record<string, Bone> = {};
  function joint(name: string, parent: Object3D, at: Vector3) {
    const g = new Bone(); g.name = name; g.userData.restWorld = at.clone(); parent.add(g);
    const pw: Vector3 = parent.userData.restWorld || V(0, 0, 0); g.position.copy(at).sub(pw); g.userData.rest = g.position.clone(); J[name] = g; return g;
  }
  const meshes: Mesh[] = [];
  function part(jt: Bone, geo: BufferGeometry, mat: PaintOpts = {}) {
    const w: Vector3 = jt.userData.restWorld; geo.translate(-w.x, -w.y, -w.z);
    const m = new Mesh(geo, painted(mat)); m.castShadow = true; m.receiveShadow = true; jt.add(m); meshes.push(m);
    return m;
  }
  const CUT_NECK = 1.74, CUT_HEAD = 2.06;
  const hips = joint("hips", root, V(0, 0.8, 0.1));
  const neck = joint("neck", hips, V(0, CUT_NECK, 0.3));
  const head = joint("head", neck, V(0, CUT_HEAD, 0.3));
  const beakJ = joint("beak", head, V(0, 2.29, 0.72));
  const crest = joint("crest", head, V(0, 2.53, 0.57));
  joint("crest.small", crest, V(0, 2.53, 0.59));
  const tailJ = joint("tail", hips, V(0, 0.95, -0.38));
  const wingR = joint("wing.R", hips, V(0.5, 1.5, 0.2));
  const wingL = joint("wing.L", hips, V(-0.5, 1.5, 0.2));
  const legC = (D.legs[D.legs.length - 1][1] + D.legs[D.legs.length - 1][2]) / 2;
  const legR = joint("leg.R", hips, V(legC, 0.76, 0));
  const legL = joint("leg.L", hips, V(-legC, 0.76, 0));
  const footR = joint("foot.R", legR, V(legC, 0.31, 0));
  const footL = joint("foot.L", legL, V(-legC, 0.31, 0));

  // beak: lofted forward from the face, height from the side view, tapering to the point
  { const secs: Section[] = []; const B = D.beak; const b0 = B[0];
    const hwAt = (z: number) => 0.07 * Math.pow(Math.max(0, 1 - (z - 0.73) / 0.205), 1.1) + 0.006;
    for (const z of [0.6, 0.66]) secs.push({ c: V(0, (b0[1] + b0[2]) / 2, z), u: X, v: Y, ru: hwAt(0.73), rv: (b0[2] - b0[1]) / 2, n: 1.4 });
    for (const [z, y0, y1] of B) secs.push({ c: V(0, (y0 + y1) / 2, z), u: X, v: Y, ru: hwAt(z), rv: Math.max(0.004, (y1 - y0) / 2), n: 1.4 });
    const l = B[B.length - 1]; secs.push({ c: V(0, (l[1] + l[2]) / 2, l[0] + 0.012), u: X, v: Y, ru: 0.001, rv: 0.001, n: 1.7 });
    const bm = part(beakJ, loft(secs, 48)); bm.material = matBeak;
  }
  // crest: two inflated plumes from the sheet's front-view outlines, narrowing to a sharp point at the brow.
  part(crest, fromMesh(S.crest), { noMarks: true });
  part(J["crest.small"], fromMesh(S.crestSmall), { noMarks: true });
  // legs + sneakers
  function legSec(r: Row, s: number, scale = 1, n = 2.4): Section { const [y, x0, x1, z0, z1] = r; return { c: V(s * (x0 + x1) / 2, y, (z0 + z1) / 2), u: X, v: Z, ru: (x1 - x0) / 2 * scale, rv: (z1 - z0) / 2 * scale, n }; }
  for (const s of [1, -1]) {
    const lj = s > 0 ? legR : legL, fj = s > 0 ? footR : footL;
    const L: Section[] = []; L.push({ ...legSec(D.legs[0], s), ru: 0.001, rv: 0.001 });
    for (const r of D.legs) L.push(legSec(r, s));
    const t = D.legs[D.legs.length - 1]; L.push(legSec([t[0] + 0.04, t[1], t[2], t[3], t[4]], s, 0.9)); L.push(legSec([t[0] + 0.06, t[1], t[2], t[3], t[4]], s, 0.0001));
    part(lj, loft(L, 72), { hi: V(9, 0.47, 9) });
    const Fo: Section[] = []; Fo.push(legSec([0, ...D.foot[0].slice(1)], s, 0.0001, 4));
    for (const r of D.foot) { const k = Math.min(1, Math.max(0, (r[0] - 0.07) / 0.08)); Fo.push(legSec(r, s, 1, 4 + (2.4 - 4) * k * k * (3 - 2 * k))); }
    const ft = D.foot[D.foot.length - 1]; Fo.push(legSec([ft[0] + 0.004, ...ft.slice(1)], s, 0.0001, 2.4));
    part(fj, loft(Fo, 96), { sole: true });
  }
  // wings: the side-view outline wrapped onto the body, with white piping along the edge
  const matPipe = new MeshBasicMaterial({ color: 0xffffff });
  for (const s of [1, -1]) {
    const jt = s > 0 ? wingR : wingL;
    const pts = D.wing[s > 0 ? "L" : "R"].map(([z, y]) => new Vector2(-0.3 + (z + 0.3) * 1.05, y));
    const curve = new SplineCurve(pts.concat([pts[0]]));
    const shape = new Shape(curve.getSpacedPoints(260).slice(0, -1));
    let g: BufferGeometry = new ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.016, bevelSegments: 5, curveSegments: 4 });
    g.deleteAttribute("uv"); g.deleteAttribute("normal"); g = mergeVertices(g, 1e-4);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const z = pa.getX(i), y = pa.getY(i), w = pa.getZ(i); pa.setXYZ(i, s * (surfX(y, z) + (w + 0.022) * 0.5 - 0.006), y, z); }
    if (s < 0 && g.index) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } }
    g.computeVertexNormals();
    part(jt, g, { wing: s });
    const edge = curve.getSpacedPoints(400).slice(0, -1).map((p) => V(s * (surfX(p.y, p.x) + 0.014), p.y, p.x));
    const pipe = new Mesh(new TubeGeometry(new CatmullRomCurve3(edge, true, "centripetal"), 600, 0.0062, 10, true), matPipe);
    const w: Vector3 = jt.userData.restWorld; pipe.geometry.translate(-w.x, -w.y, -w.z); jt.add(pipe);
  }

  // rest matrices for the painting
  root.updateMatrixWorld(true);
  meshes.forEach((m) => { const mat = m.material as MeshStandardMaterial; if (mat.userData.uRest) mat.userData.uRest.value.copy(m.matrixWorld); });

  // One continuous, skinned body column (torso -> neck -> head) so the neck bends without seams.
  // The tail is blended into the same surface (smooth union of the two traced shapes), so there is no seam.
  const skeleton = new Skeleton([hips, neck, head, tailJ]);
  const bodyGeo = fromMesh(S.body);
  { const pa = bodyGeo.attributes.position, n = pa.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < n; i++) { const y = pa.getY(i), z = pa.getZ(i);
      const toNeck = ss(CUT_NECK - 0.1, CUT_NECK + 0.08, y), toHead = ss(CUT_HEAD - 0.06, CUT_HEAD + 0.1, y);
      const tl = ss(-0.36, -0.56, z) * (1 - ss(0.8, 1.0, y));
      si.set([0, 1, 2, 3], i * 4); sw.set([(1 - toNeck) * (1 - tl), toNeck * (1 - toHead) * (1 - tl), toHead * (1 - tl), tl], i * 4); }
    bodyGeo.setAttribute("skinIndex", new Uint16BufferAttribute(si, 4));
    bodyGeo.setAttribute("skinWeight", new Float32BufferAttribute(sw, 4)); }
  const bodyMesh = new SkinnedMesh(bodyGeo, painted()); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; bodyMesh.frustumCulled = false;
  root.add(bodyMesh); root.updateMatrixWorld(true); bodyMesh.bind(skeleton);

  // ---------------- projector depth maps (rest pose) ----------------
  const projCams = VIEWS.map((n) => {
    const v = D.views[n], S = D.S;
    const cam = new OrthographicCamera(-v.origin / S, (v.W - v.origin) / S, v.ground / S, (v.ground - v.H) / S, 5, 15);
    const P = { front: [V(0, 0, 10), V(0, 0, -1)], right: [V(-10, 0, 0), V(1, 0, 0)], back: [V(0, 0, -10), V(0, 0, 1)], left: [V(10, 0, 0), V(-1, 0, 0)] }[n];
    cam.position.copy(P[0]); cam.lookAt(P[0].clone().add(P[1])); cam.updateMatrixWorld(); return cam;
  });
  const depthMat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  const depthTargets: WebGLRenderTarget[] = [];
  function bakeDepth() {
    const hidden: Object3D[] = []; scene.traverse((o) => { if (o.userData.noDepth && o.visible) { hidden.push(o); o.visible = false; } });
    const prevClear = renderer.getClearColor(new Color()), prevA = renderer.getClearAlpha();
    renderer.setClearColor(0xffffff, 1); scene.overrideMaterial = depthMat;
    projCams.forEach((cam, k) => { const v = D.views[VIEWS[k]];
      const rt = new WebGLRenderTarget(v.W * 2, v.H * 2, { minFilter: NearestFilter, magFilter: NearestFilter });
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); SH["uDep" + k].value = rt.texture; depthTargets.push(rt); });
    renderer.setRenderTarget(null); scene.overrideMaterial = null; renderer.setClearColor(prevClear, prevA);
    hidden.forEach((o) => (o.visible = true));
  }

  // contact shadow (the page draws its own ground ellipse; this is just the bird's own shadow)
  const ground = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.08 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.noDepth = true; scene.add(ground);
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const cx = cv.getContext("2d")!;
  const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(40,20,50,0.22)"); gr.addColorStop(1, "rgba(40,20,50,0)");
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const blob = new Mesh(new PlaneGeometry(1.9, 1.9), new MeshBasicMaterial({ map: new CanvasTexture(cv), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002; blob.userData.noDepth = true; scene.add(blob);
  // Compile shaders in the background (KHR_parallel_shader_compile) rather than stalling the first frame.
  await renderer.compileAsync(scene, camera);
  bakeDepth();

  // ---------------- framing ----------------
  // Crest tip to sole, facing front. Frame so that span covers the host box exactly.
  const TOP = 3.1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const span = TOP * (1 + PAD.top + PAD.bottom);              // world height the canvas shows at the target plane
    const yc = TOP * (1 + PAD.top - PAD.bottom) / 2;             // world y at the canvas centre
    const dist = span / 2 / Math.tan((camera.fov * Math.PI) / 360);
    camera.position.set(0, yc, 0.1 + dist);
    camera.lookAt(0, yc, 0.1);
    camera.updateProjectionMatrix();
    dirty = true;
  }

  // ---------------- motion ----------------
  // yaw: Quinn's facing (0 = toward the viewer). turn: where he rests. Drag spins him; he settles back on his own.
  let turn = opts.turn ?? 0, yaw = turn, yawVel = 0, lookX = 0, lookXT = 0;
  let dragging = false, lastX = 0, lastT = 0, downX = 0, downY = 0, idleSince = performance.now();
  let flapT = -1, spinFrom = 0, spinT = -1;
  let dirty = true, running = false, visible = true, raf = 0;
  const t0 = performance.now();
  const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  function pose(now: number) {
    for (const k in J) { const j = J[k]; j.rotation.set(0, 0, 0); j.position.copy(j.userData.rest); j.scale.set(1, 1, 1); }
    const T = (now - t0) / 1000;
    if (!reduceMotion) {
      const b = Math.sin(T * 2); J.hips.scale.set(1 + 0.006 * b, 1 + 0.01 * b, 1 + 0.006 * b);
      J.head.rotation.y = 0.16 * Math.sin(T * 0.7) * (1 - Math.min(1, Math.abs(lookX) * 2));
      J.head.rotation.z = 0.04 * Math.sin(T * 0.9);
      J.crest.rotation.z = 0.07 * Math.sin(T * 1.6 + 0.6); J.crest.rotation.x = 0.05 * Math.sin(T * 1.3); J["crest.small"].rotation.z = 0.1 * Math.sin(T * 1.9 + 1.2);
      J.tail.rotation.y = 0.05 * Math.sin(T * 1.1);
    }
    // look toward the pointer (left and right only): mostly the head, a little of the body
    J.head.rotation.y += lookX * 0.55; J.neck.rotation.y = lookX * 0.15;
    // flap + hop
    if (flapT >= 0) {
      const k = (now - flapT) / 900;
      if (k >= 1) flapT = -1;
      else {
        const env = Math.sin(Math.PI * k), f = 0.5 + 0.5 * Math.sin(k * Math.PI * 7 - Math.PI / 2);
        J["wing.R"].rotation.z = (0.12 + 0.95 * f) * env; J["wing.L"].rotation.z = -(0.12 + 0.95 * f) * env;
        J.hips.position.y += 0.12 * Math.max(0, Math.sin(Math.PI * Math.min(1, k * 1.6)));
        J.crest.rotation.x = -0.15 * f * env; J.tail.rotation.x = 0.1 * f * env;
        J.beak.rotation.x = 0;
      }
    }
    root.rotation.y = yaw + lookX * 0.25;
  }

  function step(now: number) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000); lastFrame = now;
    lookX += (lookXT - lookX) * Math.min(1, dt * 6);
    if (spinT >= 0) {
      const k = Math.min(1, (now - spinT) / 1500);
      yaw = turn + spinFrom + (-Math.PI * 2 - spinFrom) * easeInOut(k);
      if (k >= 1) { spinT = -1; yaw = turn; }
    } else if (!dragging) {
      yaw += yawVel * dt; yawVel *= Math.pow(0.04, dt);
      if (!reduceMotion && Math.abs(yawVel) < 0.3 && now - idleSince > 1200) {
        // ease back to the resting angle the short way round: briskly when following a scroll, gently after a drag
        const d = wrap(yaw - turn), rate = Math.abs(d) > 0.6 ? 2.5 : 7;
        yaw = turn + d - d * Math.min(1, dt * rate); if (Math.abs(d) < 1e-4) yaw = turn;
      }
    }
    const settled = !dragging && spinT < 0 && flapT < 0 && (reduceMotion || yaw === turn) && Math.abs(lookX - lookXT) < 1e-3;
    if (!reduceMotion || dirty || !settled) {
      pose(now);
      renderer.render(scene, camera);
      dirty = false;
      if (!revealed) { revealed = true; host.dataset.quinn3d = "ready"; }
    }
    if (!reduceMotion || !settled) raf = requestAnimationFrame(step);
  }
  let lastFrame = 0, revealed = false;
  function kick() { if (running && !raf) { lastFrame = 0; raf = requestAnimationFrame(step); } }
  function setRunning() {
    running = visible && document.visibilityState === "visible";
    if (running) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  // ---------------- input ----------------
  const follow = (opts.follow ?? true) && !reduceMotion && matchMedia("(pointer: fine)").matches;
  const onWindowMove = (e: PointerEvent) => {
    if (dragging || !follow) return;
    const r = host.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
    lookXT = Math.max(-1, Math.min(1, dx * 2.2));
    kick();
  };
  const onLeave = () => { lookXT = 0; kick(); };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (spinT >= 0) { yaw = turn + wrap(yaw - turn); spinT = -1; }
    dragging = true; yawVel = 0; lastX = downX = e.clientX; downY = e.clientY; lastT = performance.now();
    host.setPointerCapture(e.pointerId); host.style.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - lastX;
    const per = (Math.PI * 2) / Math.max(240, host.clientWidth * 2.4);   // a full turn ≈ a long swipe
    yaw += dx * per;
    if (now > lastT) yawVel = yawVel * 0.6 + ((dx * per) / ((now - lastT) / 1000)) * 0.4;
    lastX = e.clientX; lastT = now; idleSince = now; dirty = true; kick();
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false; host.style.cursor = "grab"; idleSince = performance.now();
    if (reduceMotion) yawVel = 0;
    if (performance.now() - lastT > 80) yawVel = 0;
    // A tap (not a drag) says hello.
    if (e.type === "pointerup" && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) api.hello();
    kick();
  };
  const hostStyle = { touchAction: host.style.touchAction, cursor: host.style.cursor };
  Object.assign(host.style, { touchAction: "pan-y", cursor: "grab" });
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);
  window.addEventListener("pointermove", onWindowMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);

  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; setRunning(); });
  const ro = new ResizeObserver(resize);
  document.addEventListener("visibilitychange", setRunning);

  host.appendChild(canvas);
  ro.observe(canvas);
  resize();
  io.observe(canvas);

  const api: Quinn3D = {
    greet() {
      if (reduceMotion) return;
      spinFrom = wrap(yaw - turn); spinT = performance.now();
      window.setTimeout(() => api.hello(), 1150);
      kick();
    },
    hello() {
      if (reduceMotion) return;
      flapT = performance.now(); kick();
    },
    setTurn(angle) {
      if (angle === turn) return;
      // Keep yaw on the same lap as the new angle so easing never goes the long way.
      yaw = angle + wrap(yaw - angle);
      turn = angle;
      if (reduceMotion && !dragging) yaw = turn;
      dirty = true; kick();
    },
    destroy() {
      running = false; if (raf) cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", setRunning);
      window.removeEventListener("pointermove", onWindowMove);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      Object.assign(host.style, hostStyle);
      delete host.dataset.quinn3d;
      document.documentElement.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => { (m as MeshBasicMaterial).map?.dispose(); m.dispose(); });
        }
      });
      [...colorTex, ...markTex].forEach((t: Texture) => t.dispose());
      depthTargets.forEach((rt) => rt.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
  return api;
}
