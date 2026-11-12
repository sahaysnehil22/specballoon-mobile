// Settings — backend base URL, connection test, app info. The backend URL is
// the one thing that must change between a laptop dev server and a deployed
// Render URL, so it lives here, persisted in AsyncStorage.

import { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../../store';
import { COLORS } from '../../theme';
import { DEFAULT_BASE_URL } from '../../api';
import { Hairline, PrimaryButton, Screen, SectionLabel } from '../../components/ui';

export default function SettingsScreen() {
  const { baseUrl, setBaseUrl, backend, health, refreshHealth, recents, clearRecents } = useStore();
  const [draft, setDraft] = useState(baseUrl);
  const [saved, setSaved] = useState('');

  async function save() {
    await setBaseUrl(draft);
    setSaved('Saved. Testing connection…');
    await refreshHealth();
    setSaved('Saved. Connection re-tested — see the status pill on Home.');
  }

  return (
    <Screen>
      <SectionLabel>Backend URL</SectionLabel>
      <Text style={styles.help}>
        The FastAPI backend that runs the extraction pipeline. Local dev:{' '}
        <Text style={styles.mono}>{DEFAULT_BASE_URL}</Text>. On a phone, localhost means the phone
        itself — use your laptop's LAN IP (e.g. http://192.168.1.20:8000) or the deployed Render URL.
      </Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={(t) => {
          setDraft(t);
          setSaved('');
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={DEFAULT_BASE_URL}
        placeholderTextColor={COLORS.faint}
      />
      <View style={styles.actions}>
        <View style={styles.actionHalf}>
          <PrimaryButton label="Save URL" onPress={save} />
        </View>
        <View style={styles.actionHalf}>
          <PrimaryButton label="Test connection" variant="ghost" onPress={refreshHealth} />
        </View>
      </View>
      {saved !== '' ? <Text style={styles.saved}>{saved}</Text> : null}

      <Hairline />
      <SectionLabel>Backend status</SectionLabel>
      <Text style={styles.status}>
        {backend === 'online'
          ? `Online — ${health?.service ?? ''} (${health?.engine ?? ''})`
          : backend === 'offline'
            ? 'Offline — the app still works with the demo drawing and local measurements.'
            : 'Checking…'}
      </Text>
      <Text style={styles.status}>
        Gemini Vision symbol resolution:{' '}
        {health ? (health.vision_configured ? 'configured on backend' : 'not configured') : 'unknown'}
      </Text>

      <Hairline />
      <SectionLabel>Data on this device</SectionLabel>
      <Text style={styles.status}>{recents.length} recent drawing(s) stored locally.</Text>
      <View style={styles.actions}>
        <PrimaryButton label="Clear recent drawings" variant="ghost" onPress={clearRecents} />
      </View>

      <Hairline />
      <SectionLabel>About</SectionLabel>
      <Text style={styles.status}>SpecBalloon Mobile 1.0.0 · Expo SDK 58 · React Native</Text>
      <Text style={styles.status}>DATUM STUDIO theme — Oxide Graphite / Anodized Stone / Safety Orange</Text>
      <Text style={styles.status}>Team Krynex — Snehil Sahay, Dhyey Patel, Kartikey Singh, Kislay Kumar</Text>
      <Text style={[styles.link]} onPress={() => Linking.openURL('https://spec-balloon.vercel.app')}>
        Web app — spec-balloon.vercel.app
      </Text>
      <Text style={styles.link} onPress={() => Linking.openURL('https://github.com/DhyeyPatel007/SpecBalloon')}>
        Source — github.com/DhyeyPatel007/SpecBalloon (MIT)
      </Text>
      <Text style={styles.note}>
        Honest gaps (full list in README.md): no list-drawings endpoint, no PDF page rendering from
        the backend, no USB-HID caliper on phones, measurements live in the backend only as the
        latest measured_value — full lot history stays on-device.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  mono: { fontFamily: 'monospace', color: COLORS.stone },
  input: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 2,
    color: COLORS.stone,
    fontSize: 14,
    fontFamily: 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionHalf: { flex: 1 },
  saved: { color: COLORS.pass, fontSize: 12, marginTop: 10 },
  status: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  link: { color: COLORS.cobalt, fontSize: 13, marginTop: 8 },
  note: { color: COLORS.faint, fontSize: 11, lineHeight: 17, marginTop: 12 },
});
