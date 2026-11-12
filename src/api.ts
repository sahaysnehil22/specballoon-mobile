// SpecBalloon API client — talks to the existing Python FastAPI backend
// (backend/main.py in DhyeyPatel007/SpecBalloon). No backend code is rewritten
// here and no endpoint is invented: every function below maps to a route that
// exists in main.py. Gaps (things the mobile UI wants that the backend does
// not expose) are listed in README.md, not faked.
//
// Routes used:
//   GET  /api/v1/health                     (fallback: GET /)
//   POST /api/v1/drawings                   (multipart PDF, 10 MB max)
//   POST /api/v1/drawings/{id}/extract     (?demo=true for the sample drawing)
//   GET  /api/v1/drawings/{id}/balloons
//   PATCH /api/v1/balloons/{char_id}
//   POST /api/v1/drawings/{id}/exports/excel
//   POST /api/v1/drawings/{id}/exports/ballooned-pdf

import type { Characteristic, DrawingMeta, HealthInfo } from './types';

export const DEFAULT_BASE_URL = 'https://specballoon-backend.onrender.com';

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const err = (body as { error?: { message?: string; code?: string } }).error;
    if (err?.message) return err.message;
    const msg = (body as { detail?: string }).detail;
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs / 1000}s — is the backend reachable at this URL?`);
    }
    throw new ApiError(`Could not reach the backend: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // fall through to the fallback message
    }
    throw new ApiError(errorMessage(body, `${fallback} (HTTP ${res.status})`), res.status);
  }
  return (await res.json()) as T;
}

/** GET /api/v1/health — falls back to GET / when /health is absent. */
export async function checkHealth(baseUrl: string): Promise<HealthInfo> {
  const res = await fetchWithTimeout(joinUrl(baseUrl, '/api/v1/health'), { method: 'GET' }, 3000).catch(
    () => fetchWithTimeout(joinUrl(baseUrl, '/'), { method: 'GET' }, 3000),
  );
  const data = await readJson<Record<string, unknown>>(res, 'Health check failed');
  return {
    status: String(data.status ?? 'unknown'),
    service: String(data.service ?? 'specballoon-backend'),
    engine: String(data.engine ?? ''),
    vision_configured: Boolean(data.vision_configured),
  };
}

export interface UploadFileRef {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/** POST /api/v1/drawings — multipart PDF upload, 10 MB limit enforced server-side. */
export async function uploadDrawing(baseUrl: string, file: UploadFileRef): Promise<DrawingMeta> {
  if (file.size !== undefined && file.size > 10 * 1024 * 1024) {
    throw new ApiError('File size exceeds the 10 MB limit.');
  }
  const form = new FormData();
  // React Native FormData file shape: { uri, name, type }.
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  const res = await fetchWithTimeout(
    joinUrl(baseUrl, '/api/v1/drawings'),
    { method: 'POST', body: form },
    30000,
  );
  const data = await readJson<Record<string, unknown>>(res, 'Upload failed');
  return normalizeDrawing(data);
}

/** POST /api/v1/drawings/{id}/extract — runs the vector pipeline on the server. */
export async function extractDrawing(
  baseUrl: string,
  drawingId: string,
  demo = false,
): Promise<Characteristic[]> {
  const res = await fetchWithTimeout(
    joinUrl(baseUrl, `/api/v1/drawings/${encodeURIComponent(drawingId)}/extract?demo=${demo}`),
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    60000,
  );
  const data = await readJson<Record<string, unknown>>(res, 'Extraction failed');
  const raw = data.characteristics ?? data.balloons ?? data;
  return normalizeCharacteristics(raw);
}

/** GET /api/v1/drawings/{id}/balloons — reload saved characteristics. */
export async function getBalloons(baseUrl: string, drawingId: string): Promise<Characteristic[]> {
  const res = await fetchWithTimeout(
    joinUrl(baseUrl, `/api/v1/drawings/${encodeURIComponent(drawingId)}/balloons`),
    { method: 'GET' },
  );
  const data = await readJson<Record<string, unknown>>(res, 'Failed to fetch balloons');
  const raw = data.characteristics ?? data.balloons ?? data;
  return normalizeCharacteristics(raw);
}

export type BalloonPatch = Partial<
  Pick<
    Characteristic,
    | 'nominal'
    | 'plusTolerance'
    | 'minusTolerance'
    | 'lsl'
    | 'usl'
    | 'units'
    | 'instrument'
    | 'measuredValue'
    | 'status'
    | 'confidence'
    | 'needs_review'
  >
> & { measured_value?: number };

/** PATCH /api/v1/balloons/{char_id} — persists edits (measured values, tolerances). */
export async function patchBalloon(
  baseUrl: string,
  charId: string,
  updates: BalloonPatch,
): Promise<Characteristic> {
  const res = await fetchWithTimeout(
    joinUrl(baseUrl, `/api/v1/balloons/${encodeURIComponent(charId)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  const data = await readJson<Record<string, unknown>>(res, 'Failed to update characteristic');
  return normalizeCharacteristic(data);
}

async function exportBytes(
  baseUrl: string,
  path: string,
  drawing: DrawingMeta | undefined,
  characteristics: Characteristic[],
  label: string,
): Promise<Uint8Array> {
  const res = await fetchWithTimeout(
    joinUrl(baseUrl, path),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drawing, characteristics }),
    },
    60000,
  );
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(errorMessage(body, `${label} failed (HTTP ${res.status})`), res.status);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** POST /api/v1/drawings/{id}/exports/excel — AS9102 Rev C workbook bytes. */
export async function exportExcel(
  baseUrl: string,
  drawingId: string,
  drawing: DrawingMeta | undefined,
  characteristics: Characteristic[],
): Promise<Uint8Array> {
  return exportBytes(
    baseUrl,
    `/api/v1/drawings/${encodeURIComponent(drawingId)}/exports/excel`,
    drawing,
    characteristics,
    'Excel export',
  );
}

/** POST /api/v1/drawings/{id}/exports/ballooned-pdf — ballooned PDF bytes. */
export async function exportBalloonedPdf(
  baseUrl: string,
  drawingId: string,
  drawing: DrawingMeta | undefined,
  characteristics: Characteristic[],
): Promise<Uint8Array> {
  return exportBytes(
    baseUrl,
    `/api/v1/drawings/${encodeURIComponent(drawingId)}/exports/ballooned-pdf`,
    drawing,
    characteristics,
    'Ballooned PDF export',
  );
}

// --- Normalisation (mirrors web src/api.ts) --------------------------------

export function normalizeDrawing(raw: Record<string, unknown>): DrawingMeta {
  return {
    id: String(raw.id ?? ''),
    part_number: String(raw.part_number ?? raw.partNumber ?? ''),
    part_name: String(raw.part_name ?? raw.partName ?? ''),
    revision: String(raw.revision ?? 'REV A'),
    page_count: typeof raw.page_count === 'number' ? raw.page_count : 1,
    width: typeof raw.width === 'number' ? raw.width : 842,
    height: typeof raw.height === 'number' ? raw.height : 595,
    is_sample: Boolean(raw.is_sample ?? raw.isDemo ?? false),
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function normalizeCharacteristics(raw: unknown): Characteristic[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => normalizeCharacteristic(item as Record<string, unknown>, idx + 1));
}

export function normalizeCharacteristic(raw: Record<string, unknown>, fallbackSeq = 1): Characteristic {
  const id =
    typeof raw.id === 'string'
      ? raw.id
      : raw.id
        ? String(raw.id)
        : `b-${Date.now()}-${fallbackSeq}`;
  const rawCallout = String(raw.rawCallout ?? raw.raw_callout ?? raw.specification ?? '');
  const nominalText = String(raw.nominal_text ?? raw.nominalText ?? rawCallout ?? '0');
  const nominalVal =
    typeof raw.nominal_value === 'number'
      ? raw.nominal_value
      : typeof raw.nominal === 'number'
        ? raw.nominal
        : parseFloat(nominalText) || 0;
  const plusTol =
    typeof raw.plusTolerance === 'number'
      ? raw.plusTolerance
      : typeof raw.plus_tol === 'number'
        ? raw.plus_tol
        : 0.05;
  const minusTol =
    typeof raw.minusTolerance === 'number'
      ? raw.minusTolerance
      : typeof raw.minus_tol === 'number'
        ? raw.minus_tol
        : 0.05;
  const lslVal =
    typeof raw.lsl === 'number'
      ? raw.lsl
      : Number((nominalVal - minusTol).toFixed(4));
  const uslVal =
    typeof raw.usl === 'number'
      ? raw.usl
      : Number((nominalVal + plusTol).toFixed(4));
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 85;
  let status: Characteristic['status'] = 'in_spec';
  if (raw.status === 'in_spec' || raw.status === 'out_of_spec' || raw.status === 'needs_review') {
    status = raw.status;
  } else if (raw.needs_review || confidence < 85) {
    status = 'needs_review';
  }
  const rawBbox = (raw.bbox ?? {}) as Record<string, number>;
  const bbox = {
    x: num(rawBbox.x, 100),
    y: num(rawBbox.y, 100),
    width: num(rawBbox.width, 80),
    height: num(rawBbox.height, 24),
  };
  const rawPos = ((raw.balloonPosition ?? raw.balloon_position ?? {}) as Record<string, number>);
  const balloonPosition = {
    x: num(rawPos.x, bbox.x + bbox.width + 20),
    y: num(rawPos.y, bbox.y - 15),
  };
  const cropDataUrl =
    typeof raw.crop_base64 === 'string' && raw.crop_base64
      ? raw.crop_base64.startsWith('data:')
        ? raw.crop_base64
        : `data:image/png;base64,${raw.crop_base64}`
      : typeof raw.cropDataUrl === 'string'
        ? raw.cropDataUrl
        : undefined;
  const reviewReasons = Array.isArray(raw.review_reasons)
    ? raw.review_reasons.map(String)
    : Array.isArray(raw.reviewReasons)
      ? raw.reviewReasons.map(String)
      : [];
  const designatorRaw = String(raw.designator ?? 'Minor');
  const designator: Characteristic['designator'] =
    designatorRaw === 'Critical' || designatorRaw === 'Major' || designatorRaw === 'Minor'
      ? designatorRaw
      : 'Standard';
  return {
    id,
    balloonNumber:
      typeof raw.balloonNumber === 'number'
        ? raw.balloonNumber
        : typeof raw.char_no === 'number'
          ? raw.char_no
          : fallbackSeq,
    char_no: typeof raw.char_no === 'number' ? raw.char_no : fallbackSeq,
    zone: String(raw.zone ?? 'B2'),
    designator,
    rawCallout,
    featureDescription: String(raw.featureDescription ?? raw.description ?? 'Linear Dimension'),
    nominal: nominalVal,
    plusTolerance: plusTol,
    minusTolerance: minusTol,
    lsl: lslVal,
    usl: uslVal,
    units: String(raw.units ?? 'mm'),
    instrument: String(raw.instrument ?? raw.gauge ?? 'Precision Digital Caliper'),
    measuredValue:
      typeof raw.measuredValue === 'number'
        ? raw.measuredValue
        : typeof raw.measured_value === 'number'
          ? raw.measured_value
          : null,
    lotMeasurements: Array.isArray(raw.lotMeasurements)
      ? raw.lotMeasurements.filter((v): v is number => typeof v === 'number')
      : [],
    status,
    confidence,
    needs_review: Boolean(raw.needs_review ?? raw.needsReview ?? status === 'needs_review'),
    review_reasons: reviewReasons,
    bbox,
    balloonPosition,
    cropDataUrl,
    isDemo: Boolean(raw.isDemo ?? raw.is_sample_data ?? false),
  };
}
