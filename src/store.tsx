// App-wide state: backend base URL, current drawing + characteristics,
// selected characteristic, recent drawings, and local lot measurements.
// Persistence is AsyncStorage only (no account, no cloud). Measurements are
// also PATCHed back to the FastAPI backend when online — a failed PATCH keeps
// the local value and surfaces a warning, it never silently drops the reading.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkHealth, DEFAULT_BASE_URL, patchBalloon } from './api';
import type { Characteristic, DrawingMeta, HealthInfo } from './types';
import { DEMO_CHARACTERISTICS, DEMO_DRAWING } from './data/sampleDrawing';

const KEY_BASE_URL = 'sb:baseUrl';
const KEY_RECENTS = 'sb:recents';
const MAX_RECENTS = 10;

export type BackendState = 'unknown' | 'online' | 'offline';

interface StoreValue {
  baseUrl: string;
  setBaseUrl: (url: string) => Promise<void>;
  backend: BackendState;
  health: HealthInfo | null;
  refreshHealth: () => Promise<void>;
  drawing: DrawingMeta | null;
  characteristics: Characteristic[];
  selectedId: string | null;
  selectCharacteristic: (id: string | null) => void;
  selected: Characteristic | null;
  setDrawingData: (drawing: DrawingMeta, chars: Characteristic[]) => void;
  loadDemoDrawing: () => void;
  clearDrawing: () => void;
  updateCharacteristicLocal: (id: string, patch: Partial<Characteristic>) => void;
  recordMeasurement: (charId: string, value: number) => Promise<boolean>;
  recents: DrawingMeta[];
  clearRecents: () => Promise<void>;
  lastError: string | null;
  setLastError: (msg: string | null) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
  const [backend, setBackend] = useState<BackendState>('unknown');
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [drawing, setDrawing] = useState<DrawingMeta | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recents, setRecents] = useState<DrawingMeta[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(KEY_BASE_URL);
        if (savedUrl) setBaseUrlState(savedUrl);
        const savedRecents = await AsyncStorage.getItem(KEY_RECENTS);
        if (savedRecents) {
          const parsed = JSON.parse(savedRecents) as DrawingMeta[];
          if (Array.isArray(parsed)) setRecents(parsed);
        }
      } catch {
        // Storage is best-effort; the app works without it.
      }
    })();
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const info = await checkHealth(baseUrl);
      setHealth(info);
      setBackend('online');
    } catch {
      setHealth(null);
      setBackend('offline');
    }
  }, [baseUrl]);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const setBaseUrl = useCallback(async (url: string) => {
    const cleaned = url.trim().replace(/\/+$/, '');
    setBaseUrlState(cleaned);
    setBackend('unknown');
    try {
      await AsyncStorage.setItem(KEY_BASE_URL, cleaned);
    } catch {
      // best-effort
    }
  }, []);

  const pushRecent = useCallback(async (meta: DrawingMeta) => {
    setRecents((prev) => {
      const next = [meta, ...prev.filter((r) => r.id !== meta.id)].slice(0, MAX_RECENTS);
      void AsyncStorage.setItem(KEY_RECENTS, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const setDrawingData = useCallback(
    (meta: DrawingMeta, chars: Characteristic[]) => {
      setDrawing(meta);
      setCharacteristics(chars);
      setSelectedId(chars.length > 0 ? chars[0].id : null);
      void pushRecent(meta);
    },
    [pushRecent],
  );

  const loadDemoDrawing = useCallback(() => {
    // Offline demo: the AS-4092-C benchmark dataset, copied from the web
    // repo's backend/sample_data.py. Clearly labelled sample data.
    setDrawingData(
      {
        id: DEMO_DRAWING.id,
        part_number: DEMO_DRAWING.part_number,
        part_name: DEMO_DRAWING.part_name,
        revision: DEMO_DRAWING.revision,
        page_count: DEMO_DRAWING.page_count,
        width: DEMO_DRAWING.width,
        height: DEMO_DRAWING.height,
        is_sample: true,
      },
      DEMO_CHARACTERISTICS.map((c) => ({ ...c, lotMeasurements: [...c.lotMeasurements] })),
    );
  }, [setDrawingData]);

  const clearDrawing = useCallback(() => {
    setDrawing(null);
    setCharacteristics([]);
    setSelectedId(null);
  }, []);

  const updateCharacteristicLocal = useCallback((id: string, patch: Partial<Characteristic>) => {
    setCharacteristics((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const recordMeasurement = useCallback(
    async (charId: string, value: number): Promise<boolean> => {
      const target = characteristics.find((c) => c.id === charId);
      if (!target) return false;
      const lot = [...target.lotMeasurements, value];
      updateCharacteristicLocal(charId, { measuredValue: value, lotMeasurements: lot });
      // Persist the latest reading to the backend when reachable.
      // measured_value is a real field on CharacteristicUpdateRequest.
      try {
        await patchBalloon(baseUrl, charId, { measured_value: value });
        return true;
      } catch {
        setLastError('Measurement saved on-device only — backend PATCH failed (offline?).');
        return false;
      }
    },
    [baseUrl, characteristics, updateCharacteristicLocal],
  );

  const clearRecents = useCallback(async () => {
    setRecents([]);
    try {
      await AsyncStorage.removeItem(KEY_RECENTS);
    } catch {
      // best-effort
    }
  }, []);

  const selected = useMemo(
    () => characteristics.find((c) => c.id === selectedId) ?? null,
    [characteristics, selectedId],
  );

  const value: StoreValue = {
    baseUrl,
    setBaseUrl,
    backend,
    health,
    refreshHealth,
    drawing,
    characteristics,
    selectedId,
    selectCharacteristic: setSelectedId,
    selected,
    setDrawingData,
    loadDemoDrawing,
    clearDrawing,
    updateCharacteristicLocal,
    recordMeasurement,
    recents,
    clearRecents,
    lastError,
    setLastError,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
