import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Input } from '@/src/components/ui';
import { useAuth, routeForRole } from '@/src/lib/auth';
import { LOGO_URL, theme, spacing } from '@/src/lib/theme';

export default function Register() {
  const { register } = useAuth();
  const [full_name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async () => {
    setErr('');
    if (!full_name || !username || !email || !password) { setErr('All fields are required'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const u = await register({ username: username.trim(), email: email.trim(), full_name, phone, password, role: 'student' });
      router.replace(routeForRole(u.role) as any);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.replace('/landing' as any)} hitSlop={10} style={{ paddingVertical: 8 }}>
            <Text style={{ color: theme.brand, fontWeight: '700' }}>← Back</Text>
          </Pressable>
          <View style={styles.logoBox}>
            <Image source={{ uri: LOGO_URL }} style={{ width: 84, height: 84 }} contentFit="contain" />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.sub}>Start learning with HENAKASHA today</Text>
          </View>
          <View style={{ marginTop: 18 }}>
            <Input testID="reg-name" label="Full Name" value={full_name} onChangeText={setName} placeholder="Your full name" />
            <Input testID="reg-username" label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Choose a username" />
            <Input testID="reg-email" label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
            <Input testID="reg-phone" label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 ..." />
            <Input testID="reg-password" label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
            {!!err && <Text style={styles.err}>{err}</Text>}
            <Button title="Create Account" testID="reg-submit" onPress={onSubmit} loading={loading} full />
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 6 }}>
              <Text style={{ color: theme.textMuted }}>Already have an account?</Text>
              <Pressable testID="reg-login-link" onPress={() => router.replace('/(auth)/login' as any)}>
                <Text style={{ color: theme.brand, fontWeight: '800' }}>Sign in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.lg },
  logoBox: { alignItems: 'center', marginTop: 8 },
  title: { fontSize: 22, fontWeight: '900', color: theme.text, marginTop: 12 },
  sub: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
  err: { color: theme.error, marginBottom: 10, fontSize: 13, fontWeight: '700' },
});
