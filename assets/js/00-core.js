/* ==========================================================================
   CORE829 Cybersecurity — interazioni e motion design
   Nessuna dipendenza esterna. Rispetta prefers-reduced-motion.
   ========================================================================== */

const root = document.documentElement;
root.classList.add("js");

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const T0 = performance.now();

/* Simbolo CORE829 (viewBox 0 0 1022 692) */
const MARK_PATHS = [
  "M464.805 29.531A331 346 0 1 0 629.059 195.526A14 14 0 0 0 609.015 189.485A166 180 0 0 0 525 346A194 208 0 1 1 377.278 144.005A14 14 0 0 0 392.621 138.032A359 374 0 0 1 467.853 53.027A14 14 0 0 0 464.805 29.531Z",
  "M557.195 662.469A331 346 0 1 0 392.941 496.474A14 14 0 0 0 412.985 502.515A166 180 0 0 0 497 346A194 208 0 1 1 644.722 547.995A14 14 0 0 0 629.379 553.968A359 374 0 0 1 554.147 638.973A14 14 0 0 0 557.195 662.469Z",
];
const MARK_W = 1022;
const MARK_H = 692;
