/*
 * Behaviours for <Quinn> (full body) and <QuinnFace> (expressions).
 * Everything here reacts to the visitor — there are no idle loops — and
 * nothing animates under prefers-reduced-motion (view and mood changes are
 * instant state swaps either way).
 */
import type { QuinnView } from "../components/Quinn.astro";
import type { Mood } from "../components/QuinnFace.astro";
import type { MountOptions, Quinn3D } from "./quinn3d/index";

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setView(el: HTMLElement, view: QuinnView) {
  if (el.dataset.view !== view && el.querySelector(`[data-v="${view}"]`)) el.dataset.view = view;
}

/**
 * Mount the 3D Quinn on `host` (the box holding a <Quinn> poster). three.js
 * and the model download now, so call this once the page has settled.
 * Resolves null — leaving the poster in place — on Save-Data, without
 * WebGL 2, or if anything fails to load.
 */
export async function loadQuinn3D(host: HTMLElement, opts: Omit<MountOptions, "reducedMotion"> = {}): Promise<Quinn3D | null> {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return null;
  try {
    const { mountQuinn3D } = await import("./quinn3d/index");
    return await mountQuinn3D(host, { reducedMotion: reducedMotion(), ...opts });
  } catch {
    return null;
  }
}

const moodTimers = new WeakMap<HTMLElement, number>();

/** Set an expression; with `ms`, settle back to `content` afterwards. */
export function setMood(face: HTMLElement, mood: Mood, ms?: number) {
  window.clearTimeout(moodTimers.get(face));
  face.dataset.mood = mood;
  if (ms) moodTimers.set(face, window.setTimeout(() => (face.dataset.mood = "content"), ms));
}

/** A quick blink, then back to whatever the face was doing. */
export function blink(face: HTMLElement) {
  if (reducedMotion() || face.dataset.mood === "blink") return;
  const before = (face.dataset.mood as Mood) ?? "content";
  face.dataset.mood = "blink";
  window.setTimeout(() => {
    if (face.dataset.mood === "blink") face.dataset.mood = before;
  }, 130);
}
