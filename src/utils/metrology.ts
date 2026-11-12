// On-device metrology math. These are pure calculations over the backend's
// limits — no invented data. Verdict bands and Cp/Cpk follow the same
// definitions the web workspace uses (Bay 04 SPC telemetry).

import type { Characteristic, Verdict } from '../types';

/**
 * Verdict for one measured value against [LSL, USL].
 * WARN = inside the limits but within 10% of the tolerance band of a limit
 * (approaching the edge — worth a second look before sign-off).
 */
export function verdictFor(c: Characteristic, value: number | null | undefined): Verdict {
  if (value === null || value === undefined || Number.isNaN(value)) return 'UNMEASURED';
  const { lsl, usl } = c;
  if (value < lsl || value > usl) return 'FAIL';
  const band = Math.max(usl - lsl, 0);
  if (band > 0) {
    const edge = band * 0.1;
    if (value - lsl < edge || usl - value < edge) return 'WARN';
  }
  return 'PASS';
}

export function verdictColor(v: Verdict): string {
  switch (v) {
    case 'PASS':
      return '#22C55E';
    case 'WARN':
      return '#F59E0B';
    case 'FAIL':
      return '#EF4444';
    default:
      return '#9C9B96';
  }
}

export interface SpcResult {
  n: number;
  mean: number | null;
  cp: number | null;
  cpk: number | null;
}

/** Cp / Cpk from a lot of measurements. Null until n >= 2 with spread. */
export function spcFor(c: Characteristic, values: number[]): SpcResult {
  const n = values.length;
  if (n < 2) return { n, mean: null, cp: null, cpk: null };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1);
  const sd = Math.sqrt(variance);
  if (sd <= 0) return { n, mean, cp: null, cpk: null };
  const tol = c.usl - c.lsl;
  if (tol <= 0) return { n, mean, cp: null, cpk: null };
  const cp = tol / (6 * sd);
  const cpu = (c.usl - mean) / (3 * sd);
  const cpl = (mean - c.lsl) / (3 * sd);
  return { n, mean, cp, cpk: Math.min(cpu, cpl) };
}

export function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

/** "Ø30.00 H7 (+0.021 / −0.000)" style tolerance line, or nominal ±tol. */
export function toleranceLine(c: Characteristic): string {
  const plus = `+${fmt(c.plusTolerance, 3)}`;
  const minus = `−${fmt(c.minusTolerance, 3)}`;
  return `${fmt(c.nominal, 3)} ${c.units} (${plus} / ${minus})`;
}
