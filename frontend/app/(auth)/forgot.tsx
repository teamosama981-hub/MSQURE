import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Input } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

export default function Forgot() {
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const request = async () => {
    setErr(''); setMsg(''); setLoading(true);
    try {
      const r = await api.post('/auth/forgot-password', { username });
      setMsg(`Your reset code: ${r.data.reset_code}\nValid for 30 minutes. Enter it below.`);
      setStage('reset');
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'User not found');
    } finally { setLoading(false); }
  };

  const reset = async () => {
    setErr(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { username, reset_code: code, new_password: pw });
      router.replace('/(auth)/login' as any);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Invalid code');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.sub}>{stage === 'request' ? 'Enter your username to get a reset code.' : 'Enter the code and set a new password.'}</Text>
        <View style={{ marginTop: 20 }}>
          <Input testID="forgot-username" label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
          {stage === 'reset' && (
            <>
              <Input testID="forgot-code" label="Reset Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
              <Input testID="forgot-new-pw" label="New Password" value={pw} onChangeText={setPw} secureTextEntry />
            </>
          )}
          {!!msg && <Text style={styles.msg}>{msg}</Text>}
          {!!err && <Text style={styles.err}>{err}</Text>}
          <Button
            title={stage === 'request' ? 'Get Reset Code' : 'Reset Password'}
            testID="forgot-submit"
            onPress={stage === 'request' ? request : reset}
            loading={loading} full
          />
          <Button title="Back to Login" variant="ghost" testID="forgot-back" onPress={() => router.replace('/(auth)/login' as any)} full />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '900', color: theme.text },
  sub: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
  msg: { backgroundColor: '#E8FBEE', color: theme.greenDeep, padding: 10, borderRadius: 10, fontSize: 13, marginBottom: 10, fontWeight: '700' },
  err: { color: theme.error, marginBottom: 10, fontSize: 13, fontWeight: '700' },
});
