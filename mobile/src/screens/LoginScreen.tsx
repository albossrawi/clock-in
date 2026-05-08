import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import AnimatedButton from '@/components/AnimatedButton';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) Alert.alert('Sign in failed', error);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clock-in</Text>
      <Text style={styles.subtitle}>Sign in to start your shift</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor="#94a3b8"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor="#94a3b8"
      />

      {submitting ? (
        <View style={styles.loading}><ActivityIndicator color="#fff" /></View>
      ) : (
        <AnimatedButton
          label="Sign in"
          color="#2563eb"
          onPress={onSubmit}
          style={{ marginTop: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0f172a' },
  title: { fontSize: 36, fontWeight: '700', color: '#f8fafc', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  loading: { paddingVertical: 28, marginTop: 12, alignItems: 'center' },
});
