// Caliper DRO — manual measurement entry plus a simulated hardware pulse.
// Real USB-HID Mitutoyo calipers (the web workspace's Bay 04) cannot attach
// to a phone over USB-HID, so the pulse is simulated: it draws a value near
// nominal inside the tolerance band, exactly like the web "spacebar pulse".
// Every recorded reading is appended to the lot and PATCHed to the backend
// (measured_value) when online. Cp/Cpk are computed on-device from the lot.

import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../../store';
import { COLORS, designatorColor } from '../../theme';
import { fmt, spcFor, toleranceLine, verdictColor, verdictFor } from '../../utils/metrology';
import { Hairline, PrimaryButton, Screen, SectionLabel, VerdictBadge } from '../../components/ui';

export default function CaliperScreen() {
  const { drawing, characteristics, selected, selectCharacteristic, recordMeasurement, lastError } =
    useStore();
  const [input, setInput] = useState('');
  const [pulse, setPulse] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const lot = useMemo(() => selected?.lotMeasurements ?? [], [selected]);
  const spc = useMemo(() => (selected ? spcFor(selected, lot) : null), [selected, lot]);
  const pulseVerdict = selected && pulse !== null ? verdictFor(selected, pulse) : null;

  if (!drawing || characteristics.length === 0 || !selected) {
    return (
      <Screen>
        <Text style={styles.empty}>No characteristic selected.</Text>
        <Text style={styles.emptySub}>
          Load a drawing first — the caliper measures against a real ballooned characteristic.
        </Text>
      </Screen>
    );
  }

  // Narrowed past the guard: `selected` is a live store value, so bind it to
  // a local const for the handlers below (TS does not carry the guard's
  // narrowing into closures over the destructured store value).
  const current = selected;

  function simulatePulse() {
    // Simulated HID pulse: a plausible reading near nominal, inside the band
    // most of the time, occasionally near an edge. Clearly labelled simulated.
    const span = Math.max(current.usl - current.lsl, 0.001);
    const centre = (current.usl + current.lsl) / 2;
    const jitter = (Math.random() * 2 - 1) * span * 0.45;
    const value = Number((centre + jitter).toFixed(3));
    setPulse(value);
    setInput(String(value));
    setNote('Simulated pulse — no USB-HID caliper is attached to this phone.');
  }

  async function record(value: number) {
    if (Number.isNaN(value)) {
      setNote('Enter a numeric reading first.');
      return;
    }
    const ok = await recordMeasurement(current.id, value);
    setNote(
      ok
        ? `Recorded ${fmt(value)} ${current.units} — saved to backend.`
        : `Recorded ${fmt(value)} ${current.units} — saved on-device only (backend unreachable).`,
    );
    setPulse(null);
    setInput('');
  }

  return (
    <Screen>
      <SectionLabel>Measure — {drawing.part_number}</SectionLabel>
      <View style={styles.selector}>
        <FlatList
          data={characteristics}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                selectCharacteristic(item.id);
                setPulse(null);
                setInput('');
                setNote('');
              }}
              style={[
                styles.charChip,
                item.id === selected.id && styles.charChipActive,
              ]}
            >
              <Text
                style={[
                  styles.charChipText,
                  { color: designatorColor(item.designator) },
                  item.id === selected.id && styles.charChipTextActive,
                ]}
              >
                {item.balloonNumber}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.feature}>{selected.featureDescription}</Text>
        <Text style={styles.callout}>{selected.rawCallout || toleranceLine(selected)}</Text>
        <Text style={styles.limits}>
          Nominal {fmt(selected.nominal)} {selected.units} · LSL {fmt(selected.lsl)} · USL {fmt(selected.usl)}
        </Text>
        <Text style={styles.gauge}>{selected.instrument}</Text>
      </View>

      <View style={styles.dro}>
        <Text style={styles.droLabel}>DIGITAL READOUT — {selected.units.toUpperCase()}</Text>
        <Text style={styles.droValue}>
          {pulse !== null ? fmt(pulse) : input !== '' ? input : '———.———'}
        </Text>
        {pulseVerdict ? (
          <View style={styles.droVerdict}>
            <VerdictBadge verdict={pulseVerdict} />
            <Text style={[styles.droVerdictText, { color: verdictColor(pulseVerdict) }]}>
              {pulseVerdict === 'PASS'
                ? 'in tolerance'
                : pulseVerdict === 'WARN'
                  ? 'near a limit — re-check'
                  : 'OUT OF TOLERANCE'}
            </Text>
          </View>
        ) : null}
      </View>

      <TextInput
        style={styles.input}
        placeholder={`Enter measured value (${selected.units})`}
        placeholderTextColor={COLORS.faint}
        value={input}
        onChangeText={setInput}
        keyboardType="decimal-pad"
      />
      <View style={styles.actions}>
        <View style={styles.actionHalf}>
          <PrimaryButton label="Simulate pulse" variant="cobalt" onPress={simulatePulse} />
        </View>
        <View style={styles.actionHalf}>
          <PrimaryButton
            label="Record reading"
            onPress={() => record(parseFloat(input))}
            disabled={input.trim() === ''}
          />
        </View>
      </View>
      {note !== '' ? <Text style={styles.note}>{note}</Text> : null}
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      <Hairline />
      <SectionLabel>
        Lot — {lot.length} reading{lot.length === 1 ? '' : 's'}
        {spc && spc.mean !== null ? ` · mean ${fmt(spc.mean)}` : ''}
      </SectionLabel>
      {spc ? (
        <View style={styles.spcRow}>
          <Text style={styles.spc}>
            Cp {spc.cp !== null ? fmt(spc.cp, 2) : '—'} · Cpk {spc.cpk !== null ? fmt(spc.cpk, 2) : '—'}
          </Text>
          <Text style={styles.spcNote}>
            {spc.n < 2
              ? 'Need 2+ readings for Cp/Cpk.'
              : spc.cpk !== null && spc.cpk >= 1.33
                ? 'Process capable (Cpk ≥ 1.33).'
                : spc.cpk !== null
                  ? 'Cpk below 1.33 — process needs attention.'
                  : 'No spread in readings yet.'}
          </Text>
        </View>
      ) : null}
      {lot.length === 0 ? (
        <Text style={styles.emptySub}>No readings yet for this characteristic.</Text>
      ) : (
        <View style={styles.lotGrid}>
          {lot.map((v, i) => (
            <View key={`${v}-${i}`} style={styles.lotCell}>
              <Text style={styles.lotValue}>{fmt(v)}</Text>
              <Text style={styles.lotVerdict}>{verdictFor(selected, v)}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.footnote}>
        The web workspace reads live USB-HID Mitutoyo pulses; phones have no HID host path for
        calipers, so this screen simulates the pulse and records manually. Values sync to the
        backend via PATCH /api/v1/balloons/{'{id}'}.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.stone, fontSize: 14, fontWeight: '600', marginTop: 12 },
  emptySub: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  selector: { marginTop: 12, marginHorizontal: -16, paddingHorizontal: 16 },
  charChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: COLORS.panel,
  },
  charChipActive: { borderColor: COLORS.orange, backgroundColor: COLORS.ink },
  charChipText: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  charChipTextActive: { color: COLORS.orange },
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    padding: 14,
    marginTop: 14,
  },
  feature: { color: COLORS.stone, fontSize: 15, fontWeight: '700' },
  callout: { color: COLORS.muted, fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  limits: { color: COLORS.muted, fontSize: 12, fontFamily: 'monospace', marginTop: 6 },
  gauge: { color: COLORS.faint, fontSize: 11, marginTop: 6 },
  dro: {
    backgroundColor: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.orange,
    borderRadius: 2,
    padding: 16,
    marginTop: 14,
    alignItems: 'center',
  },
  droLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, color: COLORS.muted },
  droValue: { fontFamily: 'monospace', fontSize: 44, fontWeight: '700', color: COLORS.stone, marginTop: 6 },
  droVerdict: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  droVerdictText: { fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    color: COLORS.stone,
    fontSize: 16,
    fontFamily: 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionHalf: { flex: 1 },
  note: { color: COLORS.cobalt, fontSize: 12, lineHeight: 17, marginTop: 12 },
  error: { color: COLORS.fail, fontSize: 12, lineHeight: 17, marginTop: 8 },
  spcRow: { marginTop: 10 },
  spc: { color: COLORS.stone, fontFamily: 'monospace', fontSize: 13 },
  spcNote: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  lotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  lotCell: {
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.panel,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 84,
  },
  lotValue: { color: COLORS.stone, fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  lotVerdict: { color: COLORS.muted, fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
  footnote: { color: COLORS.faint, fontSize: 11, lineHeight: 17, marginTop: 16 },
});
