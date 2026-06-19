import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

export default function Recording() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/recordings/${id}`).then(res => {
      setR(res.data);
      api.post('/progress', { course_id: res.data.course_id, item_id: id, watched: true }).catch(() => {});
    }).catch(e => setErr(e?.response?.data?.detail || 'Cannot load'));
  }, [id]);

  if (err) return <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center' }}><Text style={{ textAlign: 'center', color: theme.error, fontWeight: '700' }}>{err}</Text></SafeAreaView>;
  if (!r) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.brand} /></View>;

  const embedHtml = `<html><body style="margin:0;background:#000"><iframe width="100%" height="100%" src="${r.embed_url}?rel=0" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></body></html>`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color="#fff" /></Pressable>
        <Text style={st.headT} numberOfLines={1}>{r.title}</Text>
      </View>
      <View style={st.player}>
        {Platform.OS === 'web' ? (
          // @ts-ignore
          <iframe src={`${r.embed_url}?rel=0`} style={{ width: '100%', height: '100%', border: 0 }} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <WebView source={{ html: embedHtml }} style={{ flex: 1, backgroundColor: '#000' }} allowsFullscreenVideo javaScriptEnabled domStorageEnabled />
        )}
      </View>
      <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={st.title}>{r.title}</Text>
        <Text style={st.sub}>{r.duration_min ? `${r.duration_min} min • ` : ''}YouTube Lecture</Text>
        {!!r.description && <Text style={st.desc}>{r.description}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#000' },
  headT: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  player: { aspectRatio: 16 / 9, backgroundColor: '#000' },
  title: { fontSize: 18, fontWeight: '900', color: theme.text },
  sub: { fontSize: 12, color: theme.textMuted, marginTop: 4, fontWeight: '700' },
  desc: { fontSize: 14, color: theme.textMuted, marginTop: 12, lineHeight: 22 },
});
