import type { Signal, SignalCategory } from './types.js';

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function makeSignal(
  id: string,
  category: SignalCategory,
  weight: number,
  intensity: number,
  summary: string,
  details?: string,
): Signal {
  const clamped = clamp01(intensity);
  return {
    id,
    category,
    weight,
    intensity: round2(clamped),
    points: round1(weight * clamped),
    summary,
    details,
  };
}
