import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, apiUrl } from '@/src/lib/api';
import { theme, spacing, LOGO_URL, FOUNDATION } from '@/src/lib/theme';

export default function Verify() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/certificates/verify/${id}`).then(r => setC(r.data)).catch(() => setErr('Verification failed'));
  }, [id]);

  if (err) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Text style={{ textAlign: 'center', color: theme.error, fontWeight: '900' }}>{err}</Text></SafeAreaView>;
  if (!c) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.brand} /></View>;

  if (!c.valid) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FCEBED', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="close-circle" size={80} color={theme.error} />
        <Text style={{ fontSize: 22, fontWeight: '900', color: theme.error, marginTop: 12 }}>NOT VALID</Text>
        <Text style={{ color: theme.textMuted, marginTop: 6, textAlign: 'center' }}>{c.message || 'This certificate is not valid.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color={theme.brand} /></Pressable>

        <View style={st.frame}>
          <View style={st.brandBox}>
            <Image source={{ uri: LOGO_URL }} style={{ width: 80, height: 80 }} contentFit="contain" />
            <Text style={st.foundation}>{FOUNDATION}</Text>
            <Text style={st.tag}>Educate • Empower • Elevate</Text>
          </View>

          <View style={st.validPill}>
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
            <Text style={st.validTxt}>THIS CERTIFICATE IS VALID</Text>
          </View>

          <Text style={st.label}>Awarded To</Text>
          <Text style={st.name}>{c.student_name}</Text>

          <Text style={st.label}>For Successfully Completing</Text>
          <Text style={st.course}>{c.course_name}</Text>

          <View style={st.row}>
            <View style={st.col}>
              <Text style={st.k}>Email</Text>
              <Text style={st.v}>{c.student_email || '-'}</Text>
            </View>
            <View style={st.col}>
              <Text style={st.k}>Phone</Text>
              <Text style={st.v}>{c.student_phone || '-'}</Text>
            </View>
          </View>
          <View style={st.row}>
            <View style={st.col}>
              <Text style={st.k}>Score</Text>
              <Text style={[st.v, { color: theme.green, fontWeight: '900' }]}>{c.score_percent?.toFixed(1)}%</Text>
            </View>
            <View style={st.col}>
              <Text style={st.k}>Issued On</Text>
              <Text style={st.v}>{new Date(c.issued_at).toLocaleDateString()}</Text>
            </View>
          </View>
          <Text style={st.cid}>Certificate ID: {c.certificate_id}</Text>

          <View style={st.qrBox}>
            <Image source={{ uri: apiUrl(`/certificates/${c.certificate_id}/qr.png`) }} style={st.qr} contentFit="contain" />
            <Text style={st.scan}>Scan to verify</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  frame: { borderWidth: 4, borderColor: theme.brand, borderRadius: 22, padding: spacing.xl, marginTop: 12 },
  brandBox: { alignItems: 'center', borderBottomWidth: 2, borderBottomColor: theme.saffron, paddingBottom: 14, marginBottom: 14 },
  foundation: { fontSize: 13, fontWeight: '900', color: theme.brand, marginTop: 6, textAlign: 'center', letterSpacing: 0.6 },
  tag: { fontSize: 10, color: theme.saffron, fontWeight: '800', marginTop: 2 },
  validPill: { flexDirection: 'row', alignSelf: 'center', gap: 6, backgroundColor: theme.green, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  validTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  label: { fontSize: 11, color: theme.textMuted, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center', marginTop: 14 },
  name: { fontSize: 26, fontWeight: '900', color: theme.text, textAlign: 'center', marginTop: 4 },
  course: { fontSize: 18, fontWeight: '900', color: theme.saffron, textAlign: 'center', marginTop: 4 },
  row: { flexDirection: 'row', gap: 14, marginTop: 14 },
  col: { flex: 1, backgroundColor: theme.surface2, padding: 10, borderRadius: 10 },
  k: { fontSize: 10, color: theme.textMuted, fontWeight: '800' },
  v: { fontSize: 13, color: theme.text, fontWeight: '700', marginTop: 2 },
  cid: { textAlign: 'center', fontSize: 11, color: theme.textMuted, marginTop: 14, fontWeight: '700' },
  qrBox: { alignItems: 'center', marginTop: 14 },
  qr: { width: 140, height: 140, backgroundColor: theme.surface2, borderRadius: 12 },
  scan: { fontSize: 11, color: theme.textMuted, marginTop: 6, fontWeight: '700' },
});
