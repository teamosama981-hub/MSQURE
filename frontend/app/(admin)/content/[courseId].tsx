import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, Switch } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

type Section = 'Live' | 'Recordings' | 'Notes' | 'Tests' | 'Assignments' | 'Exams';
const SECS: Section[] = ['Live', 'Recordings', 'Notes', 'Tests', 'Assignments', 'Exams'];

export default function ContentManager() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [course, setCourse] = useState<any>(null);
  const [sec, setSec] = useState<Section>('Live');
  const [openForm, setOpenForm] = useState<Section | null>(null);

  useEffect(() => { if (courseId) api.get(`/courses/${courseId}`).then(r => setCourse(r.data)); }, [courseId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.headT} numberOfLines={1}>{course?.name || 'Content'}</Text>
          <Text style={st.headS}>Content Manager</Text>
        </View>
      </View>
      <View style={{ height: 52 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 8, gap: 8 }}>
          {SECS.map(s => (
            <Pressable key={s} testID={`cm-tab-${s}`} onPress={() => setSec(s)} style={[st.chip, sec === s && st.chipOn]}>
              <Text style={[st.chipTxt, sec === s && { color: '#fff' }]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable testID={`cm-add-${sec}`} onPress={() => setOpenForm(sec)} style={st.addBtn}>
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={st.addBtnTxt}>Add {sec}</Text>
      </Pressable>

      {sec === 'Live' && <LiveList courseId={courseId!} />}
      {sec === 'Recordings' && <RecList courseId={courseId!} />}
      {sec === 'Notes' && <NotesList courseId={courseId!} />}
      {(sec === 'Tests' || sec === 'Assignments' || sec === 'Exams') && <QuizList courseId={courseId!} kind={sec.toLowerCase().replace(/s$/, '') as any} />}

      {openForm === 'Live' && <LiveForm courseId={courseId!} onClose={() => setOpenForm(null)} />}
      {openForm === 'Recordings' && <RecForm courseId={courseId!} onClose={() => setOpenForm(null)} />}
      {openForm === 'Notes' && <NoteForm courseId={courseId!} onClose={() => setOpenForm(null)} />}
      {(openForm === 'Tests' || openForm === 'Assignments' || openForm === 'Exams') && (
        <QuizForm courseId={courseId!} kind={openForm.toLowerCase().replace(/s$/, '') as any} onClose={() => setOpenForm(null)} />
      )}
    </SafeAreaView>
  );
}

const LiveList = ({ courseId }: any) => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/live-classes', { params: { course_id: courseId } }).then(r => setItems(r.data)); }, [courseId]);
  const del = async (id: string) => { if (!confirm('Delete?')) return; await api.delete(`/live-classes/${id}`); setItems(items.filter(x => x.id !== id)); };
  return <FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={{ padding: spacing.lg, gap: 8, paddingBottom: 40 }} renderItem={({ item }) => (
    <View style={st.row}>
      <View style={{ flex: 1 }}>
        <Text style={st.rTitle}>{item.title}</Text>
        <Text style={st.rMeta}>📅 {new Date(item.scheduled_at).toLocaleString()} • {item.duration_min} min</Text>
        <Text style={[st.statusPill, { backgroundColor: item.live_status === 'live' ? theme.green : item.live_status === 'upcoming' ? theme.saffron : theme.textSubtle }]}>{item.live_status?.toUpperCase()}</Text>
      </View>
      <Pressable onPress={() => del(item.id)}><Ionicons name="trash" size={18} color={theme.error} /></Pressable>
    </View>
  )} />;
};
const RecList = ({ courseId }: any) => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/recordings', { params: { course_id: courseId } }).then(r => setItems(r.data)); }, [courseId]);
  const del = async (id: string) => { if (!confirm('Delete?')) return; await api.delete(`/recordings/${id}`); setItems(items.filter(x => x.id !== id)); };
  return <FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={{ padding: spacing.lg, gap: 8, paddingBottom: 40 }} renderItem={({ item }) => (
    <View style={st.row}>
      <Image source={{ uri: item.thumbnail }} style={{ width: 60, height: 40, borderRadius: 6, backgroundColor: theme.surface2 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={st.rTitle}>{item.title}</Text>
        <Text style={st.rMeta}>YouTube • {item.duration_min || 0} min</Text>
      </View>
      <Pressable onPress={() => del(item.id)}><Ionicons name="trash" size={18} color={theme.error} /></Pressable>
    </View>
  )} />;
};
const NotesList = ({ courseId }: any) => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/notes', { params: { course_id: courseId } }).then(r => setItems(r.data)); }, [courseId]);
  const del = async (id: string) => { if (!confirm('Delete?')) return; await api.delete(`/notes/${id}`); setItems(items.filter(x => x.id !== id)); };
  return <FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={{ padding: spacing.lg, gap: 8, paddingBottom: 40 }} renderItem={({ item }) => (
    <View style={st.row}>
      <Ionicons name="document" size={26} color={theme.brand} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={st.rTitle}>{item.title}</Text>
        <Text style={st.rMeta}>{item.file_name} • {(item.file_type || '').toUpperCase()}</Text>
      </View>
      <Pressable onPress={() => del(item.id)}><Ionicons name="trash" size={18} color={theme.error} /></Pressable>
    </View>
  )} />;
};
const QuizList = ({ courseId, kind }: any) => {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api.get('/quizzes', { params: { course_id: courseId, kind } }).then(r => setItems(r.data));
  useEffect(() => { load(); }, [courseId, kind]);
  const del = async (id: string) => { if (!confirm('Delete?')) return; await api.delete(`/quizzes/${id}`); load(); };
  return <FlatList data={items} keyExtractor={i => i.id} contentContainerStyle={{ padding: spacing.lg, gap: 8, paddingBottom: 40 }}
    ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textMuted, padding: 20 }}>No {kind}s yet</Text>}
    renderItem={({ item }) => (
    <View style={st.row}>
      <Ionicons name="clipboard" size={26} color={theme.brand} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={st.rTitle}>{item.title}</Text>
        <Text style={st.rMeta}>{item.questions?.length} Qs • {item.duration_min} min • Neg: {item.negative_marking}</Text>
      </View>
      <Pressable onPress={() => del(item.id)}><Ionicons name="trash" size={18} color={theme.error} /></Pressable>
    </View>
  )} />;
};

const Modal = ({ title, onClose, children }: any) => (
  <View style={ms.overlay}>
    <View style={ms.sheet}>
      <View style={ms.head}><Text style={ms.title}>{title}</Text><Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.text} /></Pressable></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>{children}</ScrollView>
    </View>
  </View>
);

const LiveForm = ({ courseId, onClose }: any) => {
  const [f, setF] = useState({ title: '', description: '', teams_link: '', scheduled_at: '', duration_min: '90' });
  const save = async () => {
    if (!f.title || !f.teams_link || !f.scheduled_at) { alert('Title, link & schedule required'); return; }
    try {
      await api.post('/live-classes', { course_id: courseId, title: f.title, description: f.description, teams_link: f.teams_link, scheduled_at: new Date(f.scheduled_at).toISOString(), duration_min: parseInt(f.duration_min) || 90 });
      onClose();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
  };
  return <Modal title="Schedule Live Class" onClose={onClose}>
    <Input testID="lc-title" label="Title *" value={f.title} onChangeText={(v: string) => setF({ ...f, title: v })} />
    <Input testID="lc-desc" label="Description" value={f.description} onChangeText={(v: string) => setF({ ...f, description: v })} multiline />
    <Input testID="lc-link" label="MS Teams Link *" value={f.teams_link} onChangeText={(v: string) => setF({ ...f, teams_link: v })} placeholder="https://teams.microsoft.com/l/meetup-join/..." />
    <Input testID="lc-when" label="Schedule (YYYY-MM-DD HH:MM) *" value={f.scheduled_at} onChangeText={(v: string) => setF({ ...f, scheduled_at: v })} placeholder="2026-07-15 19:00" />
    <Input testID="lc-dur" label="Duration (minutes)" value={f.duration_min} onChangeText={(v: string) => setF({ ...f, duration_min: v })} keyboardType="numeric" />
    <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>Students will see the "Go Live (Join MS Teams)" button enabled from start time to start+duration.</Text>
    <Button title="Schedule" testID="lc-save" onPress={save} full />
  </Modal>;
};

const RecForm = ({ courseId, onClose }: any) => {
  const [f, setF] = useState({ title: '', description: '', youtube_url: '', duration_min: '0' });
  const save = async () => {
    if (!f.title || !f.youtube_url) { alert('Title and YouTube URL required'); return; }
    try {
      await api.post('/recordings', { course_id: courseId, title: f.title, description: f.description, youtube_url: f.youtube_url, duration_min: parseInt(f.duration_min) || 0 });
      onClose();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
  };
  return <Modal title="Add Recording (YouTube)" onClose={onClose}>
    <Input testID="rec-title" label="Title *" value={f.title} onChangeText={(v: string) => setF({ ...f, title: v })} />
    <Input testID="rec-desc" label="Description" value={f.description} onChangeText={(v: string) => setF({ ...f, description: v })} multiline />
    <Input testID="rec-yt" label="YouTube URL *" value={f.youtube_url} onChangeText={(v: string) => setF({ ...f, youtube_url: v })} placeholder="https://youtube.com/watch?v=..." />
    <Input testID="rec-dur" label="Duration (minutes)" value={f.duration_min} onChangeText={(v: string) => setF({ ...f, duration_min: v })} keyboardType="numeric" />
    <Button title="Add Recording" testID="rec-save" onPress={save} full />
  </Modal>;
};

const NoteForm = ({ courseId, onClose }: any) => {
  const [f, setF] = useState({ title: '', description: '', file_name: '', file_type: 'pdf', file_base64: '' });
  const pick = () => {
    if (typeof window === 'undefined') { alert('Use web preview to pick files'); return; }
    // @ts-ignore
    const input = document.createElement('input'); input.type = 'file';
    input.onchange = (e: any) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result || '');
        const b64 = data.split(',')[1] || '';
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        setF({ ...f, file_base64: b64, file_name: file.name, file_type: ext });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  const save = async () => {
    if (!f.title || !f.file_base64) { alert('Title and file required'); return; }
    try { await api.post('/notes', { course_id: courseId, ...f }); onClose(); } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
  };
  return <Modal title="Upload Note" onClose={onClose}>
    <Input testID="nt-title" label="Title *" value={f.title} onChangeText={(v: string) => setF({ ...f, title: v })} />
    <Input testID="nt-desc" label="Description" value={f.description} onChangeText={(v: string) => setF({ ...f, description: v })} multiline />
    <Pressable testID="nt-pick" onPress={pick} style={st.pickBtn}>
      <Ionicons name="cloud-upload" size={20} color={theme.brand} />
      <Text style={st.pickTxt}>{f.file_name || 'Tap to pick file (PDF, PPT, DOCX, ZIP, image)'}</Text>
    </Pressable>
    <Button title="Upload" testID="nt-save" onPress={save} full />
  </Modal>;
};

const QuizForm = ({ courseId, kind, onClose }: any) => {
  const [f, setF] = useState<any>({ title: '', duration_min: '30', negative_marking: '0', enabled: true, questions: [] });
  const addQ = () => setF({ ...f, questions: [...f.questions, { id: Math.random().toString(36).slice(2), text: '', q_type: 'single', options: ['', '', '', ''], correct_options: [0], correct_integer: 0, marks: 1 }] });
  const updateQ = (i: number, patch: any) => setF({ ...f, questions: f.questions.map((q: any, idx: number) => idx === i ? { ...q, ...patch } : q) });
  const removeQ = (i: number) => setF({ ...f, questions: f.questions.filter((_: any, idx: number) => idx !== i) });
  const save = async () => {
    if (!f.title || f.questions.length === 0) { alert('Title and ≥1 question required'); return; }
    try {
      await api.post('/quizzes', {
        course_id: courseId, kind, title: f.title,
        duration_min: parseInt(f.duration_min) || 30,
        negative_marking: parseFloat(f.negative_marking) || 0,
        enabled: f.enabled,
        questions: f.questions.map((q: any) => ({
          id: q.id, text: q.text, q_type: q.q_type,
          options: q.q_type === 'integer' ? [] : q.options.filter((o: string) => o !== ''),
          correct_options: q.q_type === 'integer' ? [] : q.correct_options,
          correct_integer: q.q_type === 'integer' ? parseInt(String(q.correct_integer)) || 0 : null,
          marks: parseFloat(String(q.marks)) || 1,
        })),
      });
      onClose();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Failed'); }
  };

  return <Modal title={`Create ${kind.toUpperCase()}`} onClose={onClose}>
    <Input testID="qz-title" label="Title *" value={f.title} onChangeText={(v: string) => setF({ ...f, title: v })} placeholder="e.g. Chapter 1 Test" />
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}><Input testID="qz-dur" label="Duration (min)" value={f.duration_min} onChangeText={(v: string) => setF({ ...f, duration_min: v })} keyboardType="numeric" /></View>
      <View style={{ flex: 1 }}><Input testID="qz-neg" label="Negative Marking" value={f.negative_marking} onChangeText={(v: string) => setF({ ...f, negative_marking: v })} keyboardType="numeric" /></View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ flex: 1, fontWeight: '700', color: theme.text }}>Enabled (visible to students)</Text>
      <Switch testID="qz-enabled" value={f.enabled} onValueChange={(v) => setF({ ...f, enabled: v })} trackColor={{ true: theme.green, false: theme.border }} />
    </View>
    <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text, marginBottom: 6 }}>Questions ({f.questions.length})</Text>
    {f.questions.map((q: any, i: number) => (
      <View key={q.id} style={st.qCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontWeight: '800', color: theme.brand }}>Q{i + 1}</Text>
          <Pressable onPress={() => removeQ(i)}><Ionicons name="trash" size={16} color={theme.error} /></Pressable>
        </View>
        <Input testID={`q-text-${i}`} label="Question" value={q.text} onChangeText={(v: string) => updateQ(i, { text: v })} multiline />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['single', 'multiple', 'integer'] as const).map(t => (
            <Pressable key={t} testID={`q-type-${i}-${t}`} onPress={() => updateQ(i, { q_type: t, correct_options: t === 'single' ? [0] : [] })} style={[st.chip, q.q_type === t && st.chipOn]}>
              <Text style={[st.chipTxt, q.q_type === t && { color: '#fff' }]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        {(q.q_type === 'single' || q.q_type === 'multiple') && (
          <>
            {q.options.map((opt: string, oi: number) => (
              <View key={oi} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Pressable onPress={() => {
                  if (q.q_type === 'single') updateQ(i, { correct_options: [oi] });
                  else updateQ(i, { correct_options: q.correct_options.includes(oi) ? q.correct_options.filter((x: number) => x !== oi) : [...q.correct_options, oi] });
                }} style={[st.optBox, q.correct_options.includes(oi) && { backgroundColor: theme.green, borderColor: theme.green }]}>
                  {q.correct_options.includes(oi) && <Ionicons name="checkmark" size={12} color="#fff" />}
                </Pressable>
                <View style={{ flex: 1 }}><Input testID={`q-opt-${i}-${oi}`} value={opt} onChangeText={(v: string) => updateQ(i, { options: q.options.map((o: string, idx: number) => idx === oi ? v : o) })} placeholder={`Option ${oi + 1}`} /></View>
              </View>
            ))}
            <Text style={{ fontSize: 10, color: theme.textMuted, marginBottom: 8 }}>{q.q_type === 'single' ? 'Tap circle to mark THE correct option' : 'Tap to toggle correct options (multiple)'}</Text>
          </>
        )}
        {q.q_type === 'integer' && (
          <Input testID={`q-int-${i}`} label="Correct Integer Answer" value={String(q.correct_integer)} onChangeText={(v: string) => updateQ(i, { correct_integer: parseInt(v) || 0 })} keyboardType="numeric" />
        )}
        <Input testID={`q-marks-${i}`} label="Marks" value={String(q.marks)} onChangeText={(v: string) => updateQ(i, { marks: v })} keyboardType="numeric" />
      </View>
    ))}
    <Button title="+ Add Question" variant="outline" testID="qz-add-q" onPress={addQ} full />
    <View style={{ height: 10 }} />
    <Button title={`Create ${kind}`} testID="qz-save" onPress={save} full />
  </Modal>;
};

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  headT: { fontSize: 15, fontWeight: '900', color: theme.text },
  headS: { fontSize: 11, color: theme.saffron, fontWeight: '800', letterSpacing: 0.5 },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: theme.surface2, flexShrink: 0 },
  chipOn: { backgroundColor: theme.brand },
  chipTxt: { fontSize: 12, color: theme.text, fontWeight: '800' },
  addBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-end', marginRight: spacing.lg, backgroundColor: theme.saffron, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  addBtnTxt: { color: '#fff', fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  rTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  rMeta: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  statusPill: { color: '#fff', fontSize: 9, fontWeight: '900', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 4, overflow: 'hidden' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderWidth: 2, borderStyle: 'dashed' as any, borderColor: theme.border, borderRadius: 12, justifyContent: 'center', marginBottom: 12 },
  pickTxt: { color: theme.brand, fontWeight: '700' },
  qCard: { padding: 12, backgroundColor: theme.surface2, borderRadius: 12, marginBottom: 10 },
  optBox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.border, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface },
});
const ms = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 17, fontWeight: '900', color: theme.text },
});
