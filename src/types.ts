// Types mirroring the SpecBalloon FastAPI backend (backend/main.py) and the
// web client's Characteristic shape (src/types/metrology.ts). The backend
// returns both snake_case and camelCase keys; the API client normalises them
// into this single shape.

export type Designator = 'Critical' | 'Major' | 'Minor' | 'Standard';

export type BackendStatus = 'in_spec' | 'out_of_spec' | 'needs_review';

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Characteristic {
  id: string;
  char_no: number;
  balloonNumber: number;
  zone: string;
  designator: Designator;
  rawCallout: string;
  featureDescription: string;
  nominal: number;
  plusTolerance: number;
  minusTolerance: number;
  lsl: number;
  usl: number;
  units: string;
  instrument: string;
  measuredValue: number | null;
  lotMeasurements: number[];
  status: BackendStatus;
  confidence: number;
  needs_review: boolean;
  review_reasons: string[];
  bbox: BBox;
  balloonPosition: Point;
  cropDataUrl?: string;
  isDemo?: boolean;
}

export interface DrawingMeta {
  id: string;
  part_number: string;
  part_name: string;
  revision: string;
  page_count: number;
  width: number;
  height: number;
  is_sample: boolean;
}

export interface HealthInfo {
  status: string;
  service: string;
  engine: string;
  vision_configured: boolean;
}

/** Result verdict computed on-device from a measured value vs [LSL, USL]. */
export type Verdict = 'PASS' | 'WARN' | 'FAIL' | 'UNMEASURED';

export interface PipelineStage {
  name: string;
  detail: string;
  time: string;
}

/** The three deterministic pipeline stages, as documented on the web site. */
export const PIPELINE_STAGES: PipelineStage[] = [
  {
    name: '01 // Vector pass',
    detail: 'PostScript Bézier traversal, rotation normalisation, DBSCAN superscript clustering',
    time: '0.15s',
  },
  {
    name: '02 // Limits math + layout',
    detail: 'ISO 286 limits, force-directed balloon spring repulsion',
    time: '0.25s',
  },
  {
    name: '03 // Crop tape + caliper',
    detail: 'High-contrast cropped visual verification, live caliper DRO',
    time: '0.05s',
  },
];
