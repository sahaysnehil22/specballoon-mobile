// Shared DATUM STUDIO UI primitives: screen shell, section labels,
// orange/cobalt buttons, verdict badges, and the characteristic tape row.

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, LABEL, designatorColor } from '../theme';
import type { Characteristic, Verdict } from '../types';
import { fmt, toleranceLine, verdictColor, verdictFor } from '../utils/metrology';

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const body = <View style={[styles.screenInner, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[LABEL, style]}>{children}</Text>;
}

export function Hairline() {
  return <View style={styles.hairline} />;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = 'orange',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'orange' | 'cobalt' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'orange' && styles.buttonOrange,
        variant === 'cobalt' && styles.buttonCobalt,
        variant === 'ghost' && styles.buttonGhost,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'ghost' && styles.buttonTextGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const color = verdictColor(verdict);
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{verdict}</Text>
    </View>
  );
}

export function StatusPill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

/** One row of the characteristic tape: balloon no., callout, limits, verdict. */
export function CharacteristicRow({
  c,
  onPress,
  selected,
}: {
  c: Characteristic;
  onPress: () => void;
  selected?: boolean;
}) {
  const verdict = verdictFor(c, c.measuredValue);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.balloon, { borderColor: designatorColor(c.designator) }]}>
        <Text style={[styles.balloonText, { color: designatorColor(c.designator) }]}>
          {c.balloonNumber}
        </Text>
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {c.featureDescription}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {c.rawCallout || toleranceLine(c)}
        </Text>
        <Text style={styles.rowLimits}>
          {toleranceLine(c)} · LSL {fmt(c.lsl)} · USL {fmt(c.usl)}
        </Text>
        <Text style={styles.rowMeta}>
          {c.zone} · {c.designator} · {c.instrument}
          {c.needs_review ? ' · NEEDS REVIEW' : ''}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <VerdictBadge verdict={verdict} />
        <Text style={styles.rowMeasured}>
          {c.measuredValue !== null ? `${fmt(c.measuredValue)} ${c.units}` : '—'}
        </Text>
        <Text style={styles.rowConf}>{fmt(c.confidence, 1)}% conf</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  screenInner: { paddingHorizontal: 16, paddingBottom: 32 },
  scrollContent: { flexGrow: 1 },
  hairline: { height: 1, backgroundColor: COLORS.hairline, marginVertical: 12 },
  button: {
    borderRadius: 2,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonOrange: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  buttonCobalt: { backgroundColor: COLORS.cobalt, borderColor: COLORS.cobalt },
  buttonGhost: { backgroundColor: 'transparent', borderColor: COLORS.hairline },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  buttonTextGhost: { color: COLORS.stone },
  badge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    padding: 12,
    marginBottom: 8,
  },
  rowSelected: { borderColor: COLORS.orange },
  rowPressed: { opacity: 0.8 },
  balloon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: COLORS.ink,
  },
  balloonText: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.stone, fontSize: 14, fontWeight: '600' },
  rowSub: { color: COLORS.muted, fontSize: 12, fontFamily: 'monospace', marginTop: 2 },
  rowLimits: { color: COLORS.muted, fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  rowMeta: { color: COLORS.faint, fontSize: 11, marginTop: 4 },
  rowRight: { alignItems: 'flex-end', marginLeft: 8 },
  rowMeasured: { color: COLORS.stone, fontSize: 12, fontFamily: 'monospace', marginTop: 6 },
  rowConf: { color: COLORS.faint, fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
});
