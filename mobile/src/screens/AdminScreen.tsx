import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface Row {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  user_id: string;
  profiles: { full_name: string | null } | null;
}

export default function AdminScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('time_entries')
      .select('id, clock_in_at, clock_out_at, user_id, profiles(full_name)')
      .gte('clock_in_at', startOfDay.toISOString())
      .order('clock_in_at', { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#f8fafc" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f8fafc" />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.muted}>For full editing and exports use the web dashboard.</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>No entries yet today.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowName}>{item.profiles?.full_name ?? item.user_id.slice(0, 8)}</Text>
          <Text style={styles.rowMeta}>
            In {format(new Date(item.clock_in_at), 'p')}
            {item.clock_out_at ? ` • Out ${format(new Date(item.clock_out_at), 'p')}` : ' • still working'}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 24, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  muted: { color: '#94a3b8', fontSize: 14, marginBottom: 16 },
  row: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12 },
  rowName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  rowMeta: { color: '#cbd5e1', fontSize: 14, marginTop: 4 },
});
