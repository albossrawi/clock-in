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
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ensureNotificationPermissions,
  scheduleNotification,
  cancelNotification,
} from '@/lib/notifications';
import { Break, TimeEntry } from '@/types';
import AnimatedButton from '@/components/AnimatedButton';

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
      .select('*')
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

  // Tick once a second so the live timer + countdown update.
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
        .select('*')
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
  const liveElapsed = entry ? formatHms(now - new Date(entry.clock_in_at).getTime()) : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f8fafc" />}
    >
      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>Hi {profile?.full_name ?? 'there'}</Text>
      </View>

      {isClockedIn && (
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Working time</Text>
          <Text style={styles.timer}>{liveElapsed}</Text>
          <Text style={styles.timerSub}>since {format(new Date(entry!.clock_in_at), 'p')}</Text>
        </View>
      )}

      {!isClockedIn && (
        <View style={styles.idleBlock}>
          <Text style={styles.idleStatus}>Not clocked in</Text>
        </View>
      )}

      <View style={styles.buttonStack}>
        {!isClockedIn && (
          <AnimatedButton
            label="Clock In"
            color="#16a34a"
            icon="power-plug"
            onPress={clockIn}
            disabled={busy}
          />
        )}

        {isClockedIn && !onBreak && (
          <>
            <AnimatedButton
              label="Start Break"
              color="#f59e0b"
              icon="coffee-outline"
              onPress={startBreak}
              disabled={busy}
            />
            <AnimatedButton
              label="Clock Out"
              color="#dc2626"
              icon="power-plug-off"
              onPress={confirmClockOut}
              disabled={busy}
            />
          </>
        )}

        {isClockedIn && onBreak && (
          <View style={styles.breakCard}>
            <Text style={styles.breakLabel}>On break</Text>
            <Text style={styles.breakTimer}>{formatMs(breakRemaining)}</Text>
            <Text style={styles.timerSub}>remaining</Text>
            <View style={{ marginTop: 16 }}>
              <AnimatedButton
                label="End break now"
                color="#334155"
                icon="play"
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

function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  greetingBlock: { alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 22, color: '#f8fafc', fontWeight: '600' },

  idleBlock: { alignItems: 'center', marginBottom: 36 },
  idleStatus: { color: '#94a3b8', fontSize: 16 },

  timerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  timerLabel: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  timer: {
    color: '#f8fafc',
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginVertical: 6,
    letterSpacing: 1,
  },
  timerSub: { color: '#94a3b8', fontSize: 13 },

  buttonStack: { gap: 16 },

  breakCard: {
    backgroundColor: '#1e293b',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
  },
  breakLabel: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 },
  breakTimer: {
    color: '#f8fafc',
    fontSize: 56,
    fontWeight: '800',
    marginVertical: 6,
    fontVariant: ['tabular-nums'],
  },
});
