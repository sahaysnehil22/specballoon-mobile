import { Tabs } from 'expo-router';
import { COLORS } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.ink },
        headerTintColor: COLORS.stone,
        headerTitleStyle: { fontFamily: 'monospace', fontSize: 14 },
        tabBarStyle: { backgroundColor: COLORS.ink, borderTopColor: COLORS.hairline },
        tabBarActiveTintColor: COLORS.orange,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'SPECBALLOON', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="upload" options={{ title: 'UPLOAD DRAWING', tabBarLabel: 'Upload' }} />
      <Tabs.Screen name="tape" options={{ title: 'CHARACTERISTIC TAPE', tabBarLabel: 'Tape' }} />
      <Tabs.Screen name="caliper" options={{ title: 'CALIPER DRO', tabBarLabel: 'Caliper' }} />
      <Tabs.Screen name="settings" options={{ title: 'SETTINGS', tabBarLabel: 'Settings' }} />
    </Tabs>
  );
}
