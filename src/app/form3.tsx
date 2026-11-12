// AS9102 Form 3 — the 14-column first-article inspection sheet, rendered
// from the same characteristics the backend extracted. Export buttons call
// the real backend export endpoints (POST /api/v1/drawings/{id}/exports/excel
// and .../exports/ballooned-pdf), save the bytes on-device with the new
// expo-file-system File API, and open the native share sheet.

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportBalloonedPdf, exportExcel } from '../api';
import { useStore } from '../store';
import { COLORS, designatorColor } from '../theme';
import { fmt, verdictFor } from '../utils/metrology';
import { PrimaryButton, Screen, SectionLabel } from '../components/ui';

const COLUMNS: { key: string; label: string; width: number }[] = [
  { key: 'no', label: 'No.', width: 44 },
  { key: 'zone', label: 'Zone', width: 52 },
  { key: 'designator', label: 'Desig.', width: 76 },
  { key: 'req', label: 'Requirement', width: 220 },
  { key: 'nominal', label: 'Nominal', width: 84 },
  { key: 'plus', label: '+Tol', width: 64 },
  { key: 'minus', label: '−Tol', width: 64 },
  { key: 'lsl', label: 'LSL', width: 84 },
  { key: 'usl', label: 'USL', width: 84 },
  { key: 'measured', label: 'Measured', width: 84 },
  { key: 'result', label: 'Result', width: 76 },
  { key: 'instrument', label: 'Instrument', width: 180 },
  { key: 'confidence', label: 'Conf.', width: 64 },
  { key: 'review', label: 'Review', width: 90 },
];

const TOTAL_WIDTH = COLUMNS.reduce((a, c) => a + c.width, 0);

export default function Form3Screen() {
  const { baseUrl, drawing, characteristics, loadDemoDrawing } = useStore();
  const [busy, setBusy] = useState<string>('');
  const [note, setNote] = useState('');

  async function saveAndShare(bytes: Uint8Array, filename: string, mimeType: string) {
    const file = new FileSystem.File(FileSystem.Paths.document, filename);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
    }
    setNote(`Saved to ${filename} — share sheet opened.`);
  }

  async function doExcel() {
    if (!drawing) return;
    setBusy('excel');
    setNote('');
    try {
      const bytes = await exportExcel(baseUrl, drawing.id, drawing, characteristics);
      await saveAndShare(bytes, `AS9102-RevC-${drawing.part_number}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Excel export failed.');
    } finally {
      setBusy('');
    }
  }

  async function doPdf() {
    if (!drawing) return;
    setBusy('pdf');
    setNote('');
    try {
      const bytes = await exportBalloonedPdf(baseUrl, drawing.id, drawing, characteristics);
      await saveAndShare(bytes, `Ballooned-${drawing.part_number}.pdf`, 'application/pdf');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Ballooned PDF export failed.');
    } finally {
      setBusy('');
    }
  }

  if (!drawing || characteristics.length === 0) {
    return (
      <Screen>
        <Text style={styles.empty}>No Form 3 yet.</Text>
        <Text style={styles.emptySub}>Upload a drawing or load the demo to build the sheet.</Text>
        <View style={styles.stack}>
          <PrimaryButton label="Load demo drawing" onPress={loadDemoDrawing} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <SectionLabel>
          AS9102 Rev C — Form 3 · {drawing.part_number} · {drawing.revision}
        </SectionLabel>
        <Text style={styles.sub}>{drawing.part_name} · {characteristics.length} characteristics</Text>
        <View style={styles.actions}>
          <View style={styles.actionHalf}>
            <PrimaryButton
              label={busy === 'excel' ? 'Exporting…' : 'Export Excel'}
              onPress={doExcel}
              disabled={busy !== ''}
            />
          </View>
          <View style={styles.actionHalf}>
            <PrimaryButton
              label={busy === 'pdf' ? 'Exporting…' : 'Ballooned PDF'}
              variant="cobalt"
              onPress={doPdf}
              disabled={busy !== ''}
            />
          </View>
        </View>
        {note !== '' ? <Text style={styles.note}>{note}</Text> : null}
        <Text style={styles.hint}>Swipe sideways to see all 14 columns.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ width: TOTAL_WIDTH }}>
          <View style={[styles.row, styles.headerRow]}>
            {COLUMNS.map((col) => (
              <Text key={col.key} style={[styles.cell, styles.headerCell, { width: col.width }]}>
                {col.label}
              </Text>
            ))}
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {characteristics.map((c, i) => {
              const verdict = verdictFor(c, c.measuredValue);
              const cells: Record<string, string> = {
                no: String(c.balloonNumber),
                zone: c.zone,
                designator: c.designator,
                req: c.featureDescription,
                nominal: `${fmt(c.nominal)} ${c.units}`,
                plus: `+${fmt(c.plusTolerance)}`,
                minus: `−${fmt(c.minusTolerance)}`,
                lsl: fmt(c.lsl),
                usl: fmt(c.usl),
                measured: c.measuredValue !== null ? fmt(c.measuredValue) : '—',
                result: verdict,
                instrument: c.instrument,
                confidence: `${fmt(c.confidence, 1)}%`,
                review: c.needs_review ? 'REVIEW' : '—',
              };
              return (
                <View key={c.id} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                  {COLUMNS.map((col) => (
                    <Text
                      key={col.key}
                      style={[
                        styles.cell,
                        { width: col.width },
                        col.key === 'result' && {
                          color:
                            verdict === 'PASS'
                              ? COLORS.pass
                              : verdict === 'WARN'
                                ? COLORS.warn
                                : verdict === 'FAIL'
                                  ? COLORS.fail
                                  : COLORS.muted,
                          fontWeight: '700',
                        },
                        col.key === 'designator' && { color: designatorColor(c.designator) },
                        col.key === 'review' && c.needs_review && { color: COLORS.warn, fontWeight: '700' },
                      ]}
                      numberOfLines={2}
                    >
                      {cells[col.key]}
                    </Text>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.stone, fontSize: 14, fontWeight: '600', marginTop: 12 },
  emptySub: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  stack: { gap: 10, marginTop: 16 },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionHalf: { flex: 1 },
  note: { color: COLORS.cobalt, fontSize: 12, lineHeight: 17, marginTop: 10 },
  hint: { color: COLORS.faint, fontSize: 11, marginTop: 10, marginBottom: 8 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  rowAlt: { backgroundColor: COLORS.panel },
  headerRow: { backgroundColor: COLORS.ink, borderBottomWidth: 1, borderBottomColor: COLORS.orange },
  cell: { color: COLORS.stone, fontSize: 11, fontFamily: 'monospace', paddingHorizontal: 6, paddingVertical: 8 },
  headerCell: { color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 },
});
