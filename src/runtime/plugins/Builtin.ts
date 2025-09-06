import type { Channels } from "../../composer/PluginChainComposer";
import type { PluginSpec } from "../../types/plugin";

// Simple easing helpers
const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const backOut = (t: number, s = 1.70158) => {
  const x = t - 1;
  return (x * x * ((s + 1) * x + s) + 1);
};

export function evalBuiltin(spec: PluginSpec, p: number): Channels {
  const name = spec.name;
  const params = spec.params ?? {};
  switch (name) {
    case "fadeIn": {
      const o = clamp01(easeOutCubic(p));
      return { opacity: o };
    }
    case "fadeOut": {
      const o = 1 - clamp01(p);
      return { opacity: o };
    }
    case "pop": {
      const max = typeof params.maxScale === "number" ? params.maxScale : 1.2;
      const s = 1 + (max - 1) * backOut(p, 1.7);
      return { sx: s, sy: s };
    }
    case "waveY": {
      const amp = typeof params.amplitudePx === "number" ? params.amplitudePx : 8;
      const freq = typeof params.frequency === "number" ? params.frequency : 2; // oscillations
      const ty = Math.sin(p * Math.PI * 2 * freq) * amp;
      return { ty };
    }
    case "shakeX": {
      const amp = typeof params.amplitudePx === "number" ? params.amplitudePx : 6;
      const cycles = typeof params.cycles === "number" ? params.cycles : 8;
      const f = Math.sin(p * Math.PI * 2 * cycles);
      return { tx: f * amp };
    }
    default:
      return {};
  }
}

