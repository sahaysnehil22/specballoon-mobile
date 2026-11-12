// Characteristic tape — the working list: nominal, ±tolerances, USL/LSL,
// measured value and PASS/WARN/FAIL verdict per balloon. Tap a row to open
// the ballooned viewer centred on that characteristic.

import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../../store';
import { COLORS } from '../../theme';
import { CharacteristicRow, PrimaryButton, Screen, SectionLabel } from '../../components/ui';
import { verdictFor } from '../../utils/metrology';
import type { Verdict } from '../../types';

type Filter = 'ALL' | Verdict | 'REVIEW';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PASS', label: 'Pass' },
  { key: 'WARN', label: 'Warn' },
  { key: 'FAIL', label: 'Fail' },
  { key: 'UNMEASURED', label: 'Unmeasured' },
  { key: 'REVIEW', label: 'Needs review' },
];

export default function TapeScreen() {
  const { drawing, characteristics, selectCharacteristic, loadDemoDrawing } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characteristics.filter((c) => {
      if (filter === 'REVIEW' && !c.needs_review) return false;
      if (filter !== 'ALL' && filter !== 'REVIEW') {
        if (verdictFor(c, c.measuredValue) !== filter) return false;
      }
      if (q) {
        const hay = `${c.balloonNumber} ${c.featureDescription} ${c.rawCallout} ${c.zone} ${c.designator}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [characteristics, filter, query]);

  if (!drawing || characteristics.length === 0) {
    return (
      <Screen>
        <Text style={styles.empty}>No characteristics yet.</Text>
        <Text style={styles.emptySub}>
          Upload a PDF drawing, or load the AS-4092-C sample to see the tape in action.
        </Text>
        <View style={styles.stack}>
          <PrimaryButton label="Upload PDF" onPress={() => router.push('/(tabs)/upload')} />
          <PrimaryButton label="Load demo drawing" variant="ghost" onPress={loadDemoDrawing} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <SectionLabel>
          {drawing.part_number} · {filtered.length}/{characteristics.length} shown
        </SectionLabel>
        <TextInput
          style={styles.search}
          placeholder="Search feature, callout, zone…"
          placeholderTextColor={COLORS.faint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, filter === f.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CharacteristicRow
            c={item}
            onPress={() => {
              selectCharacteristic(item.id);
              router.push('/viewer');
            }}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptySub}>Nothing matches this filter.</Text>}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12 },
  search: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    color: COLORS.stone,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { borderColor: COLORS.orange, backgroundColor: COLORS.panel2 },
  chipText: { color: COLORS.muted, fontSize: 11, fontFamily: 'monospace' },
  chipTextActive: { color: COLORS.orange },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  empty: { color: COLORS.stone, fontSize: 14, fontWeight: '600', marginTop: 12 },
  emptySub: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  stack: { gap: 10, marginTop: 16 },
});
