import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedButton from '@/components/AnimatedButton';

export default function SettingsScreen() {
  const { profile, session, signOut, changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChangePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert('Passwords do not match');
      return;
    }
    setSubmitting(true);
    const { error } = await changePassword(newPassword);
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not change password', error);
      return;
    }
    setNewPassword('');
    setConfirm('');
    Alert.alert('Password updated');
  };

  const roleLabel =
    profile?.role === 'super_admin'
      ? 'Master admin'
      : profile?.role === 'admin'
      ? 'Administrator'
      : 'Employee';

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{session?.user.email ?? '—'}</Text>
        <Text style={styles.muted}>{roleLabel}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <TextInput
          style={styles.input}
          placeholder="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          placeholderTextColor="#94a3b8"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          placeholderTextColor="#94a3b8"
        />
        {submitting ? (
          <View style={styles.loading}><ActivityIndicator color="#fff" /></View>
        ) : (
          <AnimatedButton label="Update password" color="#2563eb" onPress={onChangePassword} />
        )}
      </View>

      <View style={{ marginTop: 'auto' }}>
        <AnimatedButton label="Log out" color="#dc2626" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0f172a' },
  section: { marginBottom: 32 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  label: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: '#f8fafc', fontSize: 18, marginTop: 4 },
  muted: { color: '#94a3b8', fontSize: 14, marginTop: 2 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  loading: { paddingVertical: 28, alignItems: 'center' },
});
