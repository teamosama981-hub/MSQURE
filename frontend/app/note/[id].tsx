import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';
import { Button } from '@/src/components/ui';

export default function NoteView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [n, setN] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/notes/${id}`).then(r => setN(r.data)).catch(e => setErr(e?.response?.data?.detail || 'Cannot load'));
  }, [id]);

  const download = () => {
    if (!n?.file_base64) return;
    if (Platform.OS === 'web') {
      // @ts-ignore
      const link = document.createElement('a');
      link.href = `data:${guessMime(n.file_type)};base64,${n.file_base64}`;
      link.download = n.file_name || 'note';
      link.click();
    } else {
      alert('Download is supported on web preview. The file will save to your device.');
    }
  };

  if (err) return <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center' }}><Text style={{ textAlign: 'center', color: theme.error, fontWeight: '700' }}>{err}</Text></SafeAreaView>;
  if (!n) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.brand} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
        <Text style={st.headT} numberOfLines={1}>Note</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, alignItems: 'center' }}>
        <View style={st.fileIco}><Ionicons name="document" size={48} color={theme.brand} /></View>
        <Text style={st.title}>{n.title}</Text>
        <Text style={st.fname}>{n.file_name}</Text>
        <Text style={st.ft}>{(n.file_type || '').toUpperCase()}</Text>
        {!!n.description && <Text style={st.desc}>{n.description}</Text>}
        <View style={{ marginTop: 24, width: '100%' }}>
          <Button title="Download File" testID="note-download" onPress={download} full />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function guessMime(t: string) {
  const m: any = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  return m[(t || '').toLowerCase()] || 'application/octet-stream';
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  headT: { color: theme.text, fontSize: 15, fontWeight: '900', flex: 1 },
  fileIco: { width: 110, height: 110, borderRadius: 24, backgroundColor: '#E6EAFA', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  title: { fontSize: 18, fontWeight: '900', color: theme.text, marginTop: 18, textAlign: 'center' },
  fname: { fontSize: 13, color: theme.textMuted, marginTop: 4 },
  ft: { fontSize: 11, color: theme.brand, fontWeight: '900', marginTop: 6, letterSpacing: 0.5 },
  desc: { fontSize: 14, color: theme.textMuted, marginTop: 14, textAlign: 'center' },
});
