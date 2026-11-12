// Home / Dashboard — recent drawings, pipeline status, quick actions.
// Backend status comes from a live GET /api/v1/health against the configured
// base URL; recent drawings are local (AsyncStorage) because the backend
// exposes no list-drawings endpoint (see README gaps).

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../../store';
import { COLORS, designatorColor } from '../../theme';
import { CharacteristicRow, Hairline, PrimaryButton, SectionLabel, Screen, StatusPill } from '../../components/ui';
import { verdictFor } from '../../utils/metrology';
import { PIPELINE_STAGES as STAGES } from '../../types';

export default function HomeScreen() {
  const { backend, health, drawing, characteristics, recents, loadDemoDrawing, selectCharacteristic } =
    useStore();

  const summary = useMemo(() => {
    let pass = 0;
    let warn = 0;
    let fail = 0;
    let review = 0;
    let measured = 0;
    for (const c of characteristics) {
      const v = verdictFor(c, c.measuredValue);
      if (v === 'PASS') pass += 1;
      else if (v === 'WARN') warn += 1;
      else if (v === 'FAIL') fail += 1;
      if (c.measuredValue !== null) measured += 1;
      if (c.needs_review) review += 1;
    }
    return { pass, warn, fail, review, measured, total: characteristics.length };
  }, [characteristics]);

  return (
    <Screen>
      <Text style={styles.hero}>DATUM STUDIO</Text>
      <Text style={styles.heroSub}>
        Autonomous 2D CAD metrology — ballooning, ISO 286 limits &amp; AS9102 Form 3, on the shop floor.
      </Text>

      <View style={styles.statusRow}>
        <StatusPill
          text={backend === 'online' ? 'BACKEND ONLINE' : backend === 'offline' ? 'BACKEND OFFLINE' : 'CHECKING…'}
          color={backend === 'online' ? COLORS.pass : backend === 'offline' ? COLORS.fail : COLORS.warn}
        />
        {health?.vision_configured ? (
          <StatusPill text="GEMINI VISION ON" color={COLORS.cobalt} />
        ) : null}
        {drawing?.is_sample ? <StatusPill text="SAMPLE DATA" color={COLORS.warn} /> : null}
      </View>

      <Hairline />
      <SectionLabel>Current drawing</SectionLabel>
      {drawing ? (
        <View style={styles.card}>
          <Text style={styles.partNo}>{drawing.part_number}</Text>
          <Text style={styles.partName}>{drawing.part_name}</Text>
          <Text style={styles.meta}>
            {drawing.revision} · {drawing.page_count} page{drawing.page_count === 1 ? '' : 's'} ·{' '}
            {drawing.width}×{drawing.height} pt
          </Text>
          <View style={styles.countRow}>
            <Text style={styles.count}>
              <Text style={styles.countNum}>{summary.total}</Text> characteristics
            </Text>
            <Text style={styles.count}>
              <Text style={[styles.countNum, { color: COLORS.pass }]}>{summary.pass}</Text> PASS ·{' '}
              <Text style={[styles.countNum, { color: COLORS.warn }]}>{summary.warn}</Text> WARN ·{' '}
              <Text style={[styles.countNum, { color: COLORS.fail }]}>{summary.fail}</Text> FAIL
            </Text>
          </View>
          <Text style={styles.count}>
            {summary.measured}/{summary.total} measured · {summary.review} need review
          </Text>
          <View style={styles.actions}>
            <View style={styles.actionHalf}>
              <PrimaryButton label="Open viewer" onPress={() => router.push('/viewer')} />
            </View>
            <View style={styles.actionHalf}>
              <PrimaryButton
                label="Open Form 3"
                variant="cobalt"
                onPress={() => router.push('/form3')}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.empty}>No drawing loaded yet.</Text>
          <Text style={styles.emptySub}>
            Upload a vector PDF, or load the AS-4092-C sample drawing to explore the app offline.
          </Text>
          <View style={styles.actions}>
            <View style={styles.actionHalf}>
              <PrimaryButton label="Upload PDF" onPress={() => router.push('/(tabs)/upload')} />
            </View>
            <View style={styles.actionHalf}>
              <PrimaryButton label="Load demo" variant="ghost" onPress={loadDemoDrawing} />
            </View>
          </View>
        </View>
      )}

      <Hairline />
      <SectionLabel>Pipeline — deterministic, no OCR</SectionLabel>
      {STAGES.map((s) => (
        <View key={s.name} style={styles.stage}>
          <Text style={styles.stageName}>{s.name}</Text>
          <Text style={styles.stageDetail}>{s.detail}</Text>
          <Text style={styles.stageTime}>{s.time}</Text>
        </View>
      ))}

      <Hairline />
      <SectionLabel>Recent drawings</SectionLabel>
      {recents.length === 0 ? (
        <Text style={styles.emptySub}>Nothing yet — uploads you run on this device show up here.</Text>
      ) : (
        recents.map((r) => (
          <Pressable
            key={r.id}
            style={styles.recent}
            onPress={() => {
              // Recents are metadata only: the backend has no list endpoint
              // and does not serve stored PDFs back, so re-opening a recent
              // drawing requires re-upload (see README). Demo re-loads locally.
              if (r.id === 'demo-as4092c') {
                loadDemoDrawing();
              }
            }}
          >
            <Text style={[styles.recentDot, { color: designatorColor('Critical') }]}>●</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.recentTitle}>
                {r.part_number} <Text style={styles.recentRev}>{r.revision}</Text>
              </Text>
              <Text style={styles.recentSub}>{r.part_name}</Text>
            </View>
            <Text style={styles.recentHint}>{r.id === 'demo-as4092c' ? 'TAP TO RELOAD' : 'RE-UPLOAD TO OPEN'}</Text>
          </Pressable>
        ))
      )}

      {characteristics.length > 0 ? (
        <>
          <Hairline />
          <SectionLabel>Top characteristics</SectionLabel>
          {characteristics.slice(0, 3).map((c) => (
            <CharacteristicRow
              key={c.id}
              c={c}
              onPress={() => {
                selectCharacteristic(c.id);
                router.push('/viewer');
              }}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    fontFamily: 'monospace',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.stone,
    marginTop: 12,
  },
  heroSub: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    padding: 14,
    marginTop: 10,
  },
  partNo: { fontFamily: 'monospace', fontSize: 18, fontWeight: '800', color: COLORS.stone },
  partName: { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  meta: { color: COLORS.faint, fontSize: 11, fontFamily: 'monospace', marginTop: 6 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  count: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  countNum: { color: COLORS.stone, fontWeight: '700', fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionHalf: { flex: 1 },
  empty: { color: COLORS.stone, fontSize: 14, fontWeight: '600' },
  emptySub: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  stage: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.orange,
    paddingLeft: 10,
    marginTop: 10,
  },
  stageName: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: COLORS.stone },
  stageDetail: { color: COLORS.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  stageTime: { color: COLORS.orange, fontFamily: 'monospace', fontSize: 11, marginTop: 2 },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    padding: 12,
    marginTop: 8,
  },
  recentDot: { fontSize: 10, marginRight: 10 },
  recentTitle: { color: COLORS.stone, fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  recentRev: { color: COLORS.faint, fontWeight: '400' },
  recentSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  recentHint: { color: COLORS.faint, fontSize: 9, fontFamily: 'monospace', letterSpacing: 1 },
});
