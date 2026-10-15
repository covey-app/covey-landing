/*
 * Motion engine for the expressive layer (styles/expressive.css).
 *
 *   [data-progress]  gets --p: 0 → 1 as the element travels through the
 *                    viewport (0 when its top meets the viewport bottom,
 *                    1 when its bottom meets the viewport top). Add
 *                    data-progress="pin" for sticky scenes: 0 → 1 across
 *                    the element's own scroll length instead, or
 *                    data-progress="enter": 0 → 1 from the element's top
 *                    entering to the element being fully on screen (the
 *                    footer uses this so its moment ends at the page end).
 *   [data-pointer]   gets --mx / --my in −1…1 from the pointer's position
 *                    over it (fine pointers only). Children opt in with
 *                    --depth (px of travel at the edge).
 *   [data-reveal]    gets .is-in the first time it enters the viewport.
 *
 * One passive scroll listener and one rAF per frame at most; elements are
 * only measured while an IntersectionObserver says they're near the screen.
 * Under prefers-reduced-motion nothing is wired: progress sits at its final
 * value, reveals are visible, and pointer depth stays at zero.
 */

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const active = new Set<HTMLElement>();
let ticking = false;

function measure() {
  ticking = false;
  const vh = window.innerHeight;
  for (const el of active) {
    const r = el.getBoundingClientRect();
    let p: number;
    if (el.dataset.progress === "pin") {
      const span = r.height - vh;
      p = span > 0 ? -r.top / span : r.top < 0 ? 1 : 0;
    } else if (el.dataset.progress === "enter") {
      p = (vh - r.top) / Math.min(r.height, vh);
    } else {
      p = (vh - r.top) / (vh + r.height);
    }
    p = Math.min(1, Math.max(0, p));
    const prev = Number(el.dataset.p ?? -1);
    if (Math.abs(prev - p) > 0.0005) {
      el.dataset.p = p.toFixed(4);
      el.style.setProperty("--p", p.toFixed(4));
      el.dispatchEvent(new CustomEvent("scrollprogress", { detail: p }));
    }
  }
}

function requestMeasure() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(measure);
  }
}

let progressObserver: IntersectionObserver | null = null;

function wireProgress() {
  progressObserver ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) active.add(e.target as HTMLElement);
        else active.delete(e.target as HTMLElement);
      }
      requestMeasure();
    },
    { rootMargin: "20% 0px" },
  );
  document.querySelectorAll<HTMLElement>("[data-progress]").forEach((el) => {
    if (el.dataset.motionBound) return;
    el.dataset.motionBound = "true";
    progressObserver!.observe(el);
  });
}

function wirePointer() {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  document.querySelectorAll<HTMLElement>("[data-pointer]").forEach((root) => {
    if (root.dataset.motionBound) return;
    root.dataset.motionBound = "true";
    let frame = 0;
    root.addEventListener("pointermove", (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = root.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const my = ((e.clientY - r.top) / r.height) * 2 - 1;
        root.style.setProperty("--mx", mx.toFixed(3));
        root.style.setProperty("--my", my.toFixed(3));
      });
    });
    root.addEventListener("pointerleave", () => {
      root.style.setProperty("--mx", "0");
      root.style.setProperty("--my", "0");
    });
  });
}

let revealObserver: IntersectionObserver | null = null;

function wireReveals() {
  revealObserver ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          revealObserver!.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
  );
  document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)").forEach((el) => revealObserver!.observe(el));
}

let listening = false;

export function initMotion() {
  if (reduced()) {
    document.querySelectorAll<HTMLElement>("[data-progress]").forEach((el) => el.style.setProperty("--p", "1"));
    document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
    return;
  }
  document.documentElement.classList.add("js-motion");
  wireProgress();
  wirePointer();
  wireReveals();
  if (!listening) {
    listening = true;
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure, { passive: true });
  }
  requestMeasure();
}

/** Clean up between view transitions: forget elements from the old page. */
export function resetMotion() {
  active.clear();
  progressObserver?.disconnect();
  progressObserver = null;
  revealObserver?.disconnect();
  revealObserver = null;
}
