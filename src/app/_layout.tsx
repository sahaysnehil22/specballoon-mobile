import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../store';
import { COLORS } from '../theme';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.ink },
          headerTintColor: COLORS.stone,
          headerTitleStyle: { fontFamily: 'monospace', fontSize: 14 },
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="viewer"
          options={{ title: 'BALLOONED DRAWING', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="form3"
          options={{ title: 'AS9102 FORM 3', headerBackTitle: 'Back' }}
        />
      </Stack>
    </StoreProvider>
  );
}
