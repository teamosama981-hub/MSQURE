import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

export default function Announcement() {
  const [items, setItems] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [f, setF] = useState({ course_id: '', title: '', body: '', kind: 'info' as 'info' | 'warning' | 'cancel' | 'reschedule' });

  const load = () => api.get('/announcements').then(r => setItems(r.data));
  useEffect(() => { load(); api.get('/courses', { params: { status: '' } }).then(r => setCourses(r.data)); }, []);

  const send = async () => {
    if (!f.title) { alert('Title required'); return; }
    try {
      await api.post('/announcements', { course_id: f.course_id || null, title: f.title, body: f.body, kind: f.kind });
      setF({ course_id: '', title: '', body: '', kind: 'info' });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
  };
  const del = async (id: string) => { if (!confirm('Delete?')) return; await api.delete(`/announcements/${id}`); load(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
        <Text style={st.title}>Announcements</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <Text style={st.section}>Send New Announcement</Text>
        <View style={st.card}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textMuted, marginBottom: 6 }}>Audience</Text>
          <Pressable onPress={() => setF({ ...f, course_id: '' })} style={[st.chip, !f.course_id && st.chipOn]}>
            <Text style={[st.chipTxt, !f.course_id && { color: '#fff' }]}>All Students (Global)</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
            {courses.map(c => (
              <Pressable key={c.id} testID={`annc-course-${c.id}`} onPress={() => setF({ ...f, course_id: c.id })} style={[st.chip, f.course_id === c.id && st.chipOn]}>
                <Text style={[st.chipTxt, f.course_id === c.id && { color: '#fff' }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textMuted, marginBottom: 6 }}>Kind</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(['info','warning','cancel','reschedule'] as const).map(k => (
                <Pressable key={k} testID={`annc-kind-${k}`} onPress={() => setF({ ...f, kind: k })} style={[st.chip, f.kind === k && st.chipOn]}>
                  <Text style={[st.chipTxt, f.kind === k && { color: '#fff' }]}>{k.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <Input testID="annc-title" label="Title *" value={f.title} onChangeText={(v: string) => setF({ ...f, title: v })} placeholder="e.g. Class cancelled today" />
            <Input testID="annc-body" label="Body" value={f.body} onChangeText={(v: string) => setF({ ...f, body: v })} multiline numberOfLines={4} placeholder="Details for students..." />
            <Button title="Send Announcement" testID="annc-send" onPress={send} full />
          </View>
        </View>

        <Text style={st.section}>Recent Announcements</Text>
        {items.length === 0 ? <Text style={{ color: theme.textMuted, fontSize: 13 }}>None yet</Text> : items.map(a => (
          <View key={a.id} style={st.aCard}>
            <View style={{ flex: 1 }}>
              <Text style={[st.pill, { backgroundColor: a.kind === 'cancel' ? theme.error : a.kind === 'warning' ? theme.saffron : theme.brand }]}>{a.kind?.toUpperCase()}</Text>
              <Text style={st.aTitle}>{a.title}</Text>
              <Text style={st.aBody}>{a.body}</Text>
              <Text style={st.aMeta}>{a.course_id ? '📚 Course-specific' : '🌐 Global'} • {new Date(a.created_at).toLocaleString()}</Text>
            </View>
            <Pressable onPress={() => del(a.id)} hitSlop={10}><Ionicons name="trash" size={18} color={theme.error} /></Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 16, fontWeight: '900', color: theme.text, flex: 1 },
  section: { fontSize: 13, fontWeight: '900', color: theme.textMuted, letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: 8 },
  card: { backgroundColor: theme.surface, padding: spacing.lg, borderRadius: 16, borderWidth: 1, borderColor: theme.border },
  chip: { paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: 999, backgroundColor: theme.surface2, alignSelf: 'flex-start' },
  chipOn: { backgroundColor: theme.brand },
  chipTxt: { fontSize: 12, color: theme.text, fontWeight: '800' },
  aCard: { flexDirection: 'row', padding: 12, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 8 },
  pill: { color: '#fff', fontSize: 9, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', overflow: 'hidden' },
  aTitle: { fontSize: 14, fontWeight: '800', color: theme.text, marginTop: 4 },
  aBody: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  aMeta: { fontSize: 10, color: theme.textSubtle, marginTop: 4, fontWeight: '700' },
});
