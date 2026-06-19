import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Input } from '@/src/components/ui';
import { useAuth, routeForRole } from '@/src/lib/auth';
import { LOGO_URL, theme, spacing } from '@/src/lib/theme';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async () => {
    setErr(''); setLoading(true);
    try {
      const u = await login(username.trim(), password);
      router.replace(routeForRole(u.role) as any);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.replace('/landing' as any)} hitSlop={10} style={styles.back}>
            <Text style={{ color: theme.brand, fontWeight: '700' }}>← Back</Text>
          </Pressable>
          <View style={styles.logoBox}>
            <Image source={{ uri: LOGO_URL }} style={{ width: 100, height: 100 }} contentFit="contain" />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.sub}>Sign in to continue your learning</Text>
          </View>
          <View style={{ marginTop: 24 }}>
            <Input testID="login-username" label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Enter your username" />
            <Input testID="login-password" label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            {!!err && <Text style={styles.err}>{err}</Text>}
            <Pressable testID="login-forgot" onPress={() => router.push('/(auth)/forgot' as any)} style={{ alignSelf: 'flex-end', marginBottom: 12 }}>
              <Text style={{ color: theme.saffron, fontWeight: '700' }}>Forgot password?</Text>
            </Pressable>
            <Button title="Sign In" testID="login-submit" onPress={onSubmit} loading={loading} full />
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 6 }}>
              <Text style={{ color: theme.textMuted }}>New here?</Text>
              <Pressable testID="login-register-link" onPress={() => router.replace('/(auth)/register' as any)}>
                <Text style={{ color: theme.brand, fontWeight: '800' }}>Create student account</Text>
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
  back: { paddingVertical: 8 },
  logoBox: { alignItems: 'center', marginTop: 8 },
  title: { fontSize: 24, fontWeight: '900', color: theme.text, marginTop: 14 },
  sub: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
  err: { color: theme.error, marginBottom: 10, fontSize: 13, fontWeight: '700' },
});
