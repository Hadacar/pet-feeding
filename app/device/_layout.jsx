import { Stack } from 'expo-router';

export default function DeviceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="QrReadingScreen" />
      <Stack.Screen name="NetworkListScreen" />
      <Stack.Screen name="DeviceScreenBounded" />
    </Stack>
  );
} 