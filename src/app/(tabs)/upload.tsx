// Upload drawing — pick a vector PDF from the device, or photograph the
// drawing as a field reference photo. The backend accepts PDF only
// (POST /api/v1/drawings, 10 MB max), so a camera photo is kept locally as a
// site photo and is NOT sent as a drawing — the app says so instead of
// failing silently. After a successful upload the extraction pipeline runs
// automatically (POST /api/v1/drawings/{id}/extract).

import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { extractDrawing, uploadDrawing } from '../../api';
import { useStore } from '../../store';
import { COLORS } from '../../theme';
import { Hairline, PrimaryButton, Screen, SectionLabel } from '../../components/ui';

type Phase = 'idle' | 'picking' | 'uploading' | 'extracting' | 'done' | 'error';

export default function UploadScreen() {
  const { baseUrl, setDrawingData, backend, setLastError } = useStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string>('');

  async function runUpload(uri: string, name: string, mimeType: string, size?: number) {
    setPhase('uploading');
    setMessage(`Uploading ${name}…`);
    try {
      const drawing = await uploadDrawing(baseUrl, { uri, name, mimeType, size });
      setLastFile(name);
      setPhase('extracting');
      setMessage('Running vector pipeline — vector pass, limits math, balloon layout…');
      const chars = await extractDrawing(baseUrl, drawing.id);
      setDrawingData(drawing, chars);
      setPhase('done');
      setMessage(
        `${chars.length} characteristic${chars.length === 1 ? '' : 's'} ballooned on ${drawing.part_number}.`,
      );
    } catch (e) {
      setPhase('error');
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      setMessage(msg);
      setLastError(msg);
    }
  }

  async function pickPdf() {
    if (backend === 'offline') {
      setPhase('error');
      setMessage('Backend is offline at the configured URL. Check Settings → Backend URL, then retry.');
      return;
    }
    setPhase('picking');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        setPhase('idle');
        setMessage('');
        return;
      }
      const asset = result.assets[0];
      await runUpload(asset.uri, asset.name, asset.mimeType ?? 'application/pdf', asset.size);
    } catch (e) {
      setPhase('error');
      setMessage(e instanceof Error ? e.message : 'Could not pick the file.');
    }
  }

  async function takePhoto() {
    setPhase('picking');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPhase('error');
      setMessage('Camera permission denied. Use “Choose PDF” instead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) {
      setPhase('idle');
      setMessage('');
      return;
    }
    // A photo is a field reference only: the extraction backend accepts
    // vector PDFs, not raster photos. Keep it visible, say so plainly.
    setPhotoUri(result.assets[0].uri);
    setPhase('idle');
    setMessage(
      'Photo saved as a field reference. The extraction engine needs the vector PDF — choose it with “Choose PDF” to run ballooning.',
    );
  }

  return (
    <Screen>
      <Text style={styles.intro}>
        Upload a vector 2D CAD drawing (PDF, max 10 MB). The backend runs the deterministic vector
        pipeline — no OCR — and returns ballooned characteristics in seconds.
      </Text>

      <View style={styles.stack}>
        <PrimaryButton label="Choose PDF drawing" onPress={pickPdf} />
        <PrimaryButton label="Photograph drawing (reference)" variant="ghost" onPress={takePhoto} />
      </View>

      {phase !== 'idle' && phase !== 'done' && phase !== 'error' ? (
        <Text style={styles.progress}>{message}</Text>
      ) : null}
      {message !== '' && (phase === 'done' || phase === 'error') ? (
        <Text style={[styles.result, phase === 'error' && styles.resultError]}>{message}</Text>
      ) : null}
      {message !== '' && phase === 'idle' && photoUri ? (
        <Text style={styles.result}>{message}</Text>
      ) : null}

      {phase === 'done' ? (
        <View style={styles.stack}>
          <PrimaryButton label="Open ballooned viewer" onPress={() => router.push('/viewer')} />
          <PrimaryButton label="Open characteristic tape" variant="cobalt" onPress={() => router.push('/(tabs)/tape')} />
        </View>
      ) : null}

      {photoUri ? (
        <>
          <Hairline />
          <SectionLabel>Field photo (reference only — not sent to the backend)</SectionLabel>
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
        </>
      ) : null}

      <Hairline />
      <SectionLabel>What happens next</SectionLabel>
      <Text style={styles.steps}>
        1. PDF uploads to POST /api/v1/drawings{'\n'}
        2. POST /api/v1/drawings/{'{id}'}/extract runs the vector pass, ISO 286 limits and balloon layout{'\n'}
        3. Characteristics appear in the Tape, Viewer and Form 3{'\n'}
        {lastFile ? `\nLast file: ${lastFile}` : ''}
      </Text>
      <Text style={styles.note}>
        No drawing list endpoint exists on the backend, so an uploaded drawing stays available on this
        device only until you leave it — re-upload to reopen it later.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 12 },
  stack: { gap: 10, marginTop: 16 },
  progress: { color: COLORS.orange, fontFamily: 'monospace', fontSize: 12, marginTop: 16, lineHeight: 18 },
  result: { color: COLORS.pass, fontSize: 13, lineHeight: 19, marginTop: 16 },
  resultError: { color: COLORS.fail },
  photo: { width: '100%', height: 260, marginTop: 10, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.hairline },
  steps: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 10, fontFamily: 'monospace' },
  note: { color: COLORS.faint, fontSize: 11, lineHeight: 17, marginTop: 10 },
});
