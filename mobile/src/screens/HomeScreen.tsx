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
import ClockFaceButton from '@/components/ClockFaceButton';
import CircleButton from '@/components/CircleButton';
import { ensureLocationPermission, getCurrentLocation } from '@/lib/location';

export default function HomeScreen() {
  const { profile, session, companySettings } = useAuth();
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
      // Request location permission up-front; the user can still clock in
      // if they decline (the location columns just stay null).
      await ensureLocationPermission();
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

  // Compare current time to the employee's scheduled start. Returns null if
  // they have no schedule, today isn't a scheduled day, or they're inside the
  // company's grace window (early_threshold / late_threshold minutes).
  const scheduleStatus = (): { kind: 'early' | 'late'; minutes: number } | null => {
    const start = profile?.scheduled_start;
    const days = profile?.scheduled_days;
    if (!start || !days || days.length === 0) return null;

    const nowDate = new Date();
    // JS getDay: 0=Sun..6=Sat ; we use ISO 1=Mon..7=Sun.
    const isoDow = ((nowDate.getDay() + 6) % 7) + 1;
    if (!days.includes(isoDow)) return null;

    const [hh, mm] = start.split(':').map(Number);
    const scheduled = new Date(nowDate);
    scheduled.setHours(hh ?? 0, mm ?? 0, 0, 0);

    const diffMin = (nowDate.getTime() - scheduled.getTime()) / 60000;
    const earlyThr = companySettings?.early_threshold_minutes ?? 5;
    const lateThr = companySettings?.late_threshold_minutes ?? 5;

    if (diffMin < -earlyThr) return { kind: 'early', minutes: Math.round(-diffMin) };
    if (diffMin > lateThr) return { kind: 'late', minutes: Math.round(diffMin) };
    return null;
  };

  const clockIn = () => {
    if (!session?.user || busy) return;
    const status = scheduleStatus();

    if (status?.kind === 'early' && companySettings?.warn_early_clock_in !== false) {
      Alert.alert(
        'Starting early',
        `You're starting ${status.minutes} minute${status.minutes === 1 ? '' : 's'} before your scheduled time. Clock in now?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clock in', onPress: () => void doClockIn() },
        ],
      );
      return;
    }

    if (status?.kind === 'late' && companySettings?.warn_late_clock_in !== false) {
      Alert.alert(
        'Starting late',
        `You're ${status.minutes} minute${status.minutes === 1 ? '' : 's'} past your scheduled start time.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clock in', onPress: () => void doClockIn() },
        ],
      );
      return;
    }

    void doClockIn();
  };

  const doClockIn = async () => {
    if (!session?.user || busy) return;
    setBusy(true);
    try {
      // Best-effort location capture. Null if the user denied permission
      // or the GPS lookup failed (e.g. indoors with no fix).
      const loc = await getCurrentLocation();

      const nowDate = new Date();
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: session.user.id,
          clock_in_at: nowDate.toISOString(),
          clock_in_lat: loc?.lat ?? null,
          clock_in_lng: loc?.lng ?? null,
          clock_in_accuracy_m: loc?.accuracy_m ? Math.round(loc.accuracy_m) : null,
        })
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

      const loc = await getCurrentLocation();

      const { error } = await supabase
        .from('time_entries')
        .update({
          clock_out_at: new Date().toISOString(),
          clock_out_lat: loc?.lat ?? null,
          clock_out_lng: loc?.lng ?? null,
          clock_out_accuracy_m: loc?.accuracy_m ? Math.round(loc.accuracy_m) : null,
        })
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

      {!isClockedIn && (
        <View style={styles.singleButton}>
          <ClockFaceButton
            onPress={clockIn}
            disabled={busy}
            accent="#16a34a"
            icon="login"
            size={260}
            label="Clock In"
          />
        </View>
      )}

      {isClockedIn && !onBreak && (
        <View style={styles.actionStack}>
          <ClockFaceButton
            onPress={confirmClockOut}
            disabled={busy}
            accent="#dc2626"
            icon="logout"
            size={220}
            label="Clock Out"
          />
          <View style={{ marginTop: 28 }}>
            <CircleButton
              onPress={startBreak}
              disabled={busy}
              color="#f59e0b"
              icon="coffee-outline"
              label="Start Break"
              size={92}
            />
          </View>
        </View>
      )}

      {isClockedIn && onBreak && (
        <View style={styles.breakCard}>
          <Text style={styles.breakLabel}>On break</Text>
          <Text style={styles.breakTimer}>{formatMs(breakRemaining)}</Text>
          <Text style={styles.timerSub}>remaining</Text>
          <View style={{ marginTop: 18 }}>
            <CircleButton
              onPress={() => endBreak(false)}
              disabled={busy}
              color="#334155"
              icon="play"
              label="End break now"
              size={88}
            />
          </View>
        </View>
      )}
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

  singleButton: { alignItems: 'center', marginTop: 8 },
  actionStack: { alignItems: 'center' },

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
