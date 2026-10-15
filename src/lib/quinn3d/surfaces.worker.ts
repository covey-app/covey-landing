/// <reference lib="webworker" />
// Builds Quinn's implicit surfaces off the main thread (see surfaces.ts).
import { buildSurfaces, type SurfaceInput } from "./surfaces";

self.onmessage = (e: MessageEvent<SurfaceInput>) => {
  const s = buildSurfaces(e.data);
  const buffers = [s.body, s.crest, s.crestSmall].flatMap((m) => [m.position.buffer, m.normal.buffer, m.index.buffer]);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(s, buffers);
};
