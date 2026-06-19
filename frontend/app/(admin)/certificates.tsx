import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, Linking } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, apiUrl } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

export default function AdminCertificates() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api.get('/certificates').then(r => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const download = (cert: any) => {
    const url = apiUrl(`/certificates/${cert.id}/qr.png`);
    if (Platform.OS === 'web') {
      // @ts-ignore
      const a = document.createElement('a');
      a.href = url; a.download = `${(cert.user_name || 'cert').replace(/[^A-Za-z0-9]+/g, '_')}_${cert.id}.png`; a.target = '_blank'; a.click();
    } else { Linking.openURL(url); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Text style={st.title}>Certificate QR Library</Text>
        <Text style={st.sub}>Auto-generated when a student passes a course final exam (≥60%) and the course has certificate enabled. Download QR, then use ChatGPT or design tool to compose the certificate PDF with this QR embedded.</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={<View style={{ alignItems: 'center', padding: 40 }}><Ionicons name="ribbon" size={48} color={theme.textSubtle} /><Text style={{ color: theme.textMuted, marginTop: 8, textAlign: 'center', fontWeight: '700' }}>No certificates issued yet</Text></View>}
        renderItem={({ item }) => (
          <View style={st.card}>
            <Image source={{ uri: apiUrl(`/certificates/${item.id}/qr.png`) }} style={st.qr} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{item.user_name}</Text>
              <Text style={st.row}>📧 {item.user_email}</Text>
              <Text style={st.row}>📞 {item.user_phone || '-'}</Text>
              <Text style={st.row}>Course: <Text style={{ fontWeight: '800', color: theme.text }}>{item.course_name}</Text></Text>
              <Text style={st.row}>Score: <Text style={{ color: theme.green, fontWeight: '900' }}>{item.score?.toFixed(1)}%</Text> • {new Date(item.issued_at).toLocaleDateString()}</Text>
              <Text style={st.cid}>ID: {item.id}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Pressable testID={`adm-cert-dl-${item.id}`} onPress={() => download(item)} style={st.miniBtn}>
                  <Ionicons name="download" size={14} color="#fff" />
                  <Text style={st.miniTxt}>Download QR</Text>
                </Pressable>
                <Pressable testID={`adm-cert-verify-${item.id}`} onPress={() => Linking.openURL(item.verify_url)} style={[st.miniBtn, { backgroundColor: theme.green }]}>
                  <Ionicons name="shield-checkmark" size={14} color="#fff" />
                  <Text style={st.miniTxt}>Verify Page</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 18, fontWeight: '900', color: theme.text },
  sub: { fontSize: 11, color: theme.textMuted, marginTop: 4, lineHeight: 16 },
  card: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  qr: { width: 100, height: 100, backgroundColor: theme.surface2, borderRadius: 8 },
  name: { fontSize: 15, fontWeight: '900', color: theme.text },
  row: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  cid: { fontSize: 10, color: theme.textSubtle, marginTop: 4, fontWeight: '700' },
  miniBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: theme.brand, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  miniTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
