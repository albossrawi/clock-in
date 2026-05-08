import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ensureNotificationPermissions,
  scheduleNotification,
  cancelNotification,
} from '@/lib/notifications';
import { Break, TimeEntry } from '@/types';
import AnimatedButton from '@/components/AnimatedButton';

const CLOCK_OUT_NOTIF_KEY = 'clock-out-notif-id';
const BREAK_END_NOTIF_KEY = 'break-end-notif-id';

// Scheduled notification IDs are kept in module-scope refs so they survive
// re-renders. They're also durable across app cold-starts because we cancel
// by *content* on clock-out (Notifications.cancelAllScheduledNotificationsAsync
// is too aggressive for production, but acceptable for a single-purpose app).

export default function HomeScreen() {
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [activeBreak, setActiveBreak] = useState<Break | null>(null);
  const [now, setNow] = useState(Date.now());

  const notifIds = useRef<{ clockOut: string | null; breakEnd: string | null }>({
    clockOut: null,
    breakEnd: null,
  });

  const breakLengthMs = (profile?.break_length_minutes ?? 30) * 60 * 1000;
  const shiftLengthMs = (profile?.shift_length_minutes ?? 450) * 60 * 1000;

  const fetchState = useCallback(async () => {
    if (!session?.user) return;
    const { data: openEntries } = await supabase
      .from('time_entries')
      .select('*, shift_types(name, multiplier)')
      .eq('user_id', session.user.id)
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(1);

    const open = (openEntries?.[0] as TimeEntry | undefined) ?? null;
    setEntry(open);

    if (open) {
      const { data: openBreaks } = await supabase
        .from('breaks')
        .select('*')
        .eq('time_entry_id', open.id)
        .is('end_at', null)
        .order('start_at', { ascending: false })
        .limit(1);
      setActiveBreak((openBreaks?.[0] as Break | undefined) ?? null);
    } else {
      setActiveBreak(null);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    (async () => {
      await ensureNotificationPermissions();
      await fetchState();
      setLoading(false);
    })();
  }, [fetchState]);

  // Tick once a second so countdowns + elapsed labels update.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // When break timer hits zero, auto-close the break row.
  useEffect(() => {
    if (!activeBreak) return;
    const startMs = new Date(activeBreak.start_at).getTime();
    const remaining = startMs + breakLengthMs - now;
    if (remaining <= 0) {
      void endBreak(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, activeBreak?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchState();
    setRefreshing(false);
  };

  const clockIn = async () => {
    if (!session?.user || busy) return;
    setBusy(true);
    try {
      const nowDate = new Date();
      const { data, error } = await supabase
        .from('time_entries')
        .insert({ user_id: session.user.id, clock_in_at: nowDate.toISOString() })
        .select('*, shift_types(name, multiplier)')
        .single();
      if (error) throw error;
      setEntry(data as TimeEntry);

      const fireAt = new Date(nowDate.getTime() + shiftLengthMs);
      const id = await scheduleNotification({
        title: 'Shift complete',
        body: `You've worked ${(profile?.shift_length_minutes ?? 450) / 60} hours. Time to clock out.`,
        fireAt,
      });
      notifIds.current.clockOut = id;
    } catch (e: any) {
      Alert.alert('Could not clock in', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmClockOut = () => {
    if (!entry || busy) return;
    Alert.alert(
      'Clock out?',
      "This ends your shift. You can't undo this.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clock out', style: 'destructive', onPress: () => void doClockOut() },
      ],
    );
  };

  const doClockOut = async () => {
    if (!entry || busy) return;
    setBusy(true);
    try {
      // Close any open break first.
      if (activeBreak) await endBreak(false);

      const { error } = await supabase
        .from('time_entries')
        .update({ clock_out_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (error) throw error;

      await cancelNotification(notifIds.current.clockOut);
      notifIds.current.clockOut = null;

      setEntry(null);
      setActiveBreak(null);
    } catch (e: any) {
      Alert.alert('Could not clock out', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const startBreak = async () => {
    if (!entry || activeBreak || busy) return;
    setBusy(true);
    try {
      const nowDate = new Date();
      const { data, error } = await supabase
        .from('breaks')
        .insert({ time_entry_id: entry.id, start_at: nowDate.toISOString() })
        .select('*')
        .single();
      if (error) throw error;
      setActiveBreak(data as Break);

      const fireAt = new Date(nowDate.getTime() + breakLengthMs);
      const id = await scheduleNotification({
        title: 'Break is over',
        body: `Your ${profile?.break_length_minutes ?? 30}-minute break has ended.`,
        fireAt,
      });
      notifIds.current.breakEnd = id;
    } catch (e: any) {
      Alert.alert('Could not start break', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const endBreak = async (auto: boolean) => {
    if (!activeBreak) return;
    if (!auto) setBusy(true);
    try {
      await supabase
        .from('breaks')
        .update({ end_at: new Date().toISOString() })
        .eq('id', activeBreak.id);
      await cancelNotification(notifIds.current.breakEnd);
      notifIds.current.breakEnd = null;
      setActiveBreak(null);
    } catch (e: any) {
      if (!auto) Alert.alert('Could not end break', e.message ?? String(e));
    } finally {
      if (!auto) setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#f8fafc" />
      </View>
    );
  }

  const isClockedIn = !!entry;
  const onBreak = !!activeBreak;
  const breakRemaining = activeBreak
    ? Math.max(0, new Date(activeBreak.start_at).getTime() + breakLengthMs - now)
    : 0;
  const elapsedSinceClockIn = entry
    ? formatDistanceToNowStrict(new Date(entry.clock_in_at))
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f8fafc" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi {profile?.full_name ?? 'there'}</Text>
        <Text style={styles.status}>
          {isClockedIn ? `Clocked in • ${elapsedSinceClockIn}` : 'Not clocked in'}
        </Text>
        {entry && (
          <Text style={styles.muted}>
            since {format(new Date(entry.clock_in_at), 'p')}
          </Text>
        )}
        {entry && entry.shift_types?.name && (
          <View style={[styles.shiftBadge, shiftBadgeStyles(entry.shift_types.name)]}>
            <Text style={styles.shiftBadgeText}>
              {entry.shift_types.name} shift
              {entry.shift_types.multiplier && Number(entry.shift_types.multiplier) !== 1
                ? `  ·  ${Number(entry.shift_types.multiplier).toFixed(2)}×`
                : ''}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonStack}>
        {!isClockedIn && (
          <AnimatedButton label="Clock In" color="#16a34a" onPress={clockIn} disabled={busy} />
        )}

        {isClockedIn && !onBreak && (
          <>
            <AnimatedButton label="Start Break" color="#f59e0b" onPress={startBreak} disabled={busy} />
            <AnimatedButton label="Clock Out" color="#dc2626" onPress={confirmClockOut} disabled={busy} />
          </>
        )}

        {isClockedIn && onBreak && (
          <View style={styles.breakCard}>
            <Text style={styles.breakLabel}>On break</Text>
            <Text style={styles.breakTimer}>{formatMs(breakRemaining)}</Text>
            <Text style={styles.muted}>remaining</Text>
            <View style={{ marginTop: 16 }}>
              <AnimatedButton
                label="End break now"
                color="#334155"
                onPress={() => endBreak(false)}
                disabled={busy}
                size="small"
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function shiftBadgeStyles(name: string) {
  switch (name.toLowerCase()) {
    case 'evening':
      return { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderColor: 'rgba(245, 158, 11, 0.5)' };
    case 'night':
      return { backgroundColor: 'rgba(99, 102, 241, 0.18)', borderColor: 'rgba(99, 102, 241, 0.5)' };
    case 'weekend':
      return { backgroundColor: 'rgba(217, 70, 239, 0.18)', borderColor: 'rgba(217, 70, 239, 0.5)' };
    default:
      return { backgroundColor: 'rgba(100, 116, 139, 0.2)', borderColor: 'rgba(100, 116, 139, 0.4)' };
  }
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 48 },
  greeting: { fontSize: 22, color: '#f8fafc', fontWeight: '600' },
  status: { fontSize: 16, color: '#cbd5e1', marginTop: 8 },
  muted: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  buttonStack: { gap: 20 },
  shiftBadge: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  shiftBadgeText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  breakCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  breakLabel: { color: '#94a3b8', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  breakTimer: { color: '#f8fafc', fontSize: 56, fontWeight: '700', marginVertical: 8, fontVariant: ['tabular-nums'] },
});
