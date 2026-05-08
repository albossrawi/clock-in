import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

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

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{session?.user.email ?? '—'}</Text>
        <Text style={styles.muted}>
          {profile?.role === 'admin' ? 'Administrator' : 'Employee'}
        </Text>
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
        <TouchableOpacity style={styles.button} onPress={onChangePassword} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, styles.danger]} onPress={signOut}>
        <Text style={styles.buttonText}>Log out</Text>
      </TouchableOpacity>
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
  button: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 999, alignItems: 'center' },
  danger: { backgroundColor: '#dc2626' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
