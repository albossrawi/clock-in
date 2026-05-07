import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Clock-in',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleNotification(opts: {
  title: string;
  body: string;
  fireAt: Date;
}): Promise<string | null> {
  const seconds = Math.max(1, Math.round((opts.fireAt.getTime() - Date.now()) / 1000));
  return Notifications.scheduleNotificationAsync({
    content: { title: opts.title, body: opts.body, sound: 'default' },
    trigger: { seconds, channelId: 'default' },
  });
}

export async function cancelNotification(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or already cancelled — fine
  }
}
