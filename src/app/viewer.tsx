// Ballooned drawing viewer — pan/zoom sheet with numbered balloon markers.
// Honest limitation: the backend exposes no endpoint that renders a drawing
// page as an image, so the sheet is a schematic (grid + part outline) with
// balloons placed from the backend's real balloonPosition coordinates. The
// per-characteristic crop images the backend DOES return (crop_base64) are
// shown in the detail card. If a page-render endpoint is added later, drop
// the real page image behind the markers here.

import { useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { COLORS, designatorColor } from '../theme';
import { fmt, toleranceLine, verdictFor } from '../utils/metrology';
import { PrimaryButton, Screen, SectionLabel, VerdictBadge } from '../components/ui';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;

export default function ViewerScreen() {
  const { drawing, characteristics, selected, selectCharacteristic, loadDemoDrawing } = useStore();
  const { width: winW } = useWindowDimensions();
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastPan = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastPan.current = { ...translate };
      },
      onPanResponderMove: (_e, g) => {
        setTranslate({ x: lastPan.current.x + g.dx, y: lastPan.current.y + g.dy });
      },
      onPanResponderRelease: () => undefined,
    }),
  ).current;

  if (!drawing || characteristics.length === 0) {
    return (
      <Screen>
        <Text style={styles.empty}>No drawing loaded.</Text>
        <Text style={styles.emptySub}>Upload a PDF or load the demo drawing to see balloons.</Text>
        <View style={styles.stack}>
          <PrimaryButton label="Upload PDF" onPress={() => router.push('/(tabs)/upload')} />
          <PrimaryButton label="Load demo drawing" variant="ghost" onPress={loadDemoDrawing} />
        </View>
      </Screen>
    );
  }

  const sheetW = winW - 32;
  const sheetH = (sheetW * drawing.height) / Math.max(drawing.width, 1);
  const zoomIn = () => setScale((s) => Math.min(MAX_ZOOM, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(MIN_ZOOM, +(s - 0.25).toFixed(2)));
  const reset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  return (
    <Screen scroll={false}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>
          {drawing.part_number} · {characteristics.length} balloons
        </Text>
        <View style={styles.zoomRow}>
          <Pressable onPress={zoomOut} style={styles.zoomBtn}>
            <Text style={styles.zoomText}>−</Text>
          </Pressable>
          <Text style={styles.zoomLabel}>{Math.round(scale * 100)}%</Text>
          <Pressable onPress={zoomIn} style={styles.zoomBtn}>
            <Text style={styles.zoomText}>+</Text>
          </Pressable>
          <Pressable onPress={reset} style={styles.zoomBtn}>
            <Text style={styles.zoomText}>1:1</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.canvasWrap} {...panResponder.panHandlers}>
        <View
          style={[
            styles.sheet,
            { width: sheetW, height: sheetH, transform: [{ translateX: translate.x }, { translateY: translate.y }, { scale }] },
          ]}
        >
          {/* Schematic sheet: grid hairlines + part outline placeholder. */}
          <View style={styles.partOutline} />
          <Text style={styles.sheetWatermark}>SCHEMATIC SHEET — PAGE IMAGE NOT SERVED BY BACKEND</Text>
          <Text style={styles.sheetNote}>Balloon positions are the backend&apos;s real coordinates.</Text>
          {characteristics.map((c) => {
            const left = (c.balloonPosition.x / Math.max(drawing.width, 1)) * sheetW;
            const top = (c.balloonPosition.y / Math.max(drawing.height, 1)) * sheetH;
            const isSel = selected?.id === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => selectCharacteristic(c.id)}
                style={[
                  styles.marker,
                  {
                    left: left - 15,
                    top: top - 15,
                    borderColor: isSel ? COLORS.orange : designatorColor(c.designator),
                    backgroundColor: isSel ? COLORS.orange : COLORS.ink,
                  },
                ]}
              >
                <Text style={[styles.markerText, isSel && { color: '#fff' }]}>{c.balloonNumber}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {selected ? (
        <View style={styles.detail}>
          <View style={styles.detailHead}>
            <Text style={styles.detailTitle}>
              #{selected.balloonNumber} · {selected.featureDescription}
            </Text>
            <VerdictBadge verdict={verdictFor(selected, selected.measuredValue)} />
          </View>
          <Text style={styles.detailSub}>
            {selected.rawCallout || toleranceLine(selected)} · Zone {selected.zone} · {selected.designator}
          </Text>
          <Text style={styles.detailSub}>
            Nominal {fmt(selected.nominal)} {selected.units} · LSL {fmt(selected.lsl)} · USL {fmt(selected.usl)}
            {selected.measuredValue !== null ? ` · Measured ${fmt(selected.measuredValue)}` : ' · Not measured'}
          </Text>
          {selected.cropDataUrl ? (
            <Image source={{ uri: selected.cropDataUrl }} style={styles.crop} resizeMode="contain" />
          ) : (
            <Text style={styles.noCrop}>No verification crop returned for this characteristic.</Text>
          )}
          <View style={styles.detailActions}>
            <View style={styles.actionHalf}>
              <PrimaryButton label="Open in tape" variant="ghost" onPress={() => router.push('/(tabs)/tape')} />
            </View>
            <View style={styles.actionHalf}>
              <PrimaryButton label="Measure" variant="cobalt" onPress={() => router.push('/(tabs)/caliper')} />
            </View>
          </View>
        </View>
      ) : null}
      <SectionLabel>Drag to pan · buttons to zoom · tap a balloon to inspect it</SectionLabel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.stone, fontSize: 14, fontWeight: '600', marginTop: 12 },
  emptySub: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  stack: { gap: 10, marginTop: 16 },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.stone, fontFamily: 'monospace', fontSize: 12, fontWeight: '700', flex: 1 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoomBtn: {
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.panel,
    minWidth: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  zoomText: { color: COLORS.stone, fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  zoomLabel: { color: COLORS.muted, fontFamily: 'monospace', fontSize: 11, minWidth: 36, textAlign: 'center' },
  canvasWrap: { flex: 1, marginHorizontal: 16, marginTop: 12, overflow: 'hidden', backgroundColor: COLORS.ink, borderWidth: 1, borderColor: COLORS.hairline },
  sheet: { backgroundColor: '#111317', borderWidth: 1, borderColor: COLORS.hairline, position: 'relative' },
  partOutline: {
    position: 'absolute',
    left: '18%',
    top: '22%',
    width: '64%',
    height: '56%',
    borderWidth: 1.5,
    borderColor: COLORS.cobalt,
    borderRadius: 4,
  },
  sheetWatermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    textAlign: 'center',
    color: COLORS.faint,
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
  },
  sheetNote: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    textAlign: 'center',
    color: COLORS.faint,
    fontFamily: 'monospace',
    fontSize: 9,
  },
  marker: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { color: COLORS.stone, fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  detail: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    padding: 12,
  },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  detailTitle: { color: COLORS.stone, fontSize: 14, fontWeight: '700', flex: 1 },
  detailSub: { color: COLORS.muted, fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  crop: { width: '100%', height: 90, marginTop: 10, backgroundColor: COLORS.ink, borderWidth: 1, borderColor: COLORS.hairline },
  noCrop: { color: COLORS.faint, fontSize: 11, marginTop: 8 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionHalf: { flex: 1 },
});
