import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, Switch } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';
import { Button, Input } from '@/src/components/ui';

export default function AdminCourses() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const load = () => api.get('/courses', { params: { status: '' } }).then(r => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    await api.delete(`/courses/${id}`); load();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Text style={st.title}>Manage Courses</Text>
        <Pressable testID="admin-add-course" onPress={() => { setEditing(null); setOpen(true); }} style={st.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={st.addTxt}>New</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 80 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textMuted, padding: 40 }}>No courses yet</Text>}
        renderItem={({ item }) => (
          <View style={st.card}>
            <Image source={{ uri: item.thumbnail }} style={st.thumb} contentFit="cover" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={st.cName}>{item.name}</Text>
              <Text style={st.cMeta}>{item.category} • ₹{item.discount_price || item.price}</Text>
              <Text style={[st.statusPill, { backgroundColor: item.status === 'published' ? theme.green : theme.saffron }]}>{(item.status || '').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <Pressable testID={`adm-content-${item.id}`} onPress={() => router.push(`/(admin)/content/${item.id}` as any)} style={st.miniBtn}><Ionicons name="albums" size={14} color={theme.brand} /><Text style={st.miniTxt}>Content</Text></Pressable>
                <Pressable testID={`adm-edit-${item.id}`} onPress={() => { setEditing(item); setOpen(true); }} style={st.miniBtn}><Ionicons name="create" size={14} color={theme.brand} /><Text style={st.miniTxt}>Edit</Text></Pressable>
                <Pressable testID={`adm-del-${item.id}`} onPress={() => del(item.id)} style={[st.miniBtn, { backgroundColor: '#FCEBED' }]}><Ionicons name="trash" size={14} color={theme.error} /><Text style={[st.miniTxt, { color: theme.error }]}>Delete</Text></Pressable>
              </View>
            </View>
          </View>
        )}
      />
      {open && <CourseModal initial={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
    </SafeAreaView>
  );
}

const CourseModal = ({ initial, onClose, onSaved }: any) => {
  const [f, setF] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    instructor_name: initial?.instructor_name || '',
    category: initial?.category || 'Programming',
    language: initial?.language || 'English',
    price: String(initial?.price || ''),
    discount_price: String(initial?.discount_price || ''),
    duration: initial?.duration || '',
    num_classes: String(initial?.num_classes || ''),
    thumbnail: initial?.thumbnail || '',
    banner: initial?.banner || '',
    status: initial?.status || 'published',
    has_certificate: initial?.has_certificate !== false,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr(''); setLoading(true);
    try {
      const payload = { ...f, price: parseFloat(f.price) || 0, discount_price: parseFloat(f.discount_price) || 0, num_classes: parseInt(f.num_classes) || 0 };
      if (initial) await api.put(`/courses/${initial.id}`, payload);
      else await api.post('/courses', payload);
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Save failed'); }
    finally { setLoading(false); }
  };

  return (
    <View style={modalSt.overlay}>
      <View style={modalSt.sheet}>
        <View style={modalSt.head}>
          <Text style={modalSt.title}>{initial ? 'Edit Course' : 'New Course'}</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          <Input testID="cm-name" label="Course Name *" value={f.name} onChangeText={(v: string) => setF({ ...f, name: v })} />
          <Input testID="cm-desc" label="Description" value={f.description} onChangeText={(v: string) => setF({ ...f, description: v })} multiline />
          <Input testID="cm-instructor" label="Instructor Name" value={f.instructor_name} onChangeText={(v: string) => setF({ ...f, instructor_name: v })} />
          <Input testID="cm-category" label="Category *" value={f.category} onChangeText={(v: string) => setF({ ...f, category: v })} />
          <Input testID="cm-language" label="Language" value={f.language} onChangeText={(v: string) => setF({ ...f, language: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input testID="cm-price" label="Price (₹)" value={f.price} onChangeText={(v: string) => setF({ ...f, price: v })} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Input testID="cm-disc" label="Discount (₹)" value={f.discount_price} onChangeText={(v: string) => setF({ ...f, discount_price: v })} keyboardType="numeric" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input testID="cm-dur" label="Duration" value={f.duration} onChangeText={(v: string) => setF({ ...f, duration: v })} placeholder="e.g. 8 weeks" /></View>
            <View style={{ flex: 1 }}><Input testID="cm-nclass" label="# Classes" value={f.num_classes} onChangeText={(v: string) => setF({ ...f, num_classes: v })} keyboardType="numeric" /></View>
          </View>
          <Input testID="cm-thumb" label="Thumbnail URL" value={f.thumbnail} onChangeText={(v: string) => setF({ ...f, thumbnail: v })} placeholder="https://..." />
          <Input testID="cm-banner" label="Banner URL" value={f.banner} onChangeText={(v: string) => setF({ ...f, banner: v })} placeholder="https://..." />

          <View style={modalSt.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>Issue Certificate</Text>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>Generate certificate QR on final exam pass (≥60%)</Text>
            </View>
            <Switch testID="cm-cert" value={f.has_certificate} onValueChange={(v) => setF({ ...f, has_certificate: v })} trackColor={{ true: theme.green, false: theme.border }} />
          </View>
          <View style={modalSt.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>Published</Text>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>Visible to students</Text>
            </View>
            <Switch testID="cm-status" value={f.status === 'published'} onValueChange={(v) => setF({ ...f, status: v ? 'published' : 'draft' })} trackColor={{ true: theme.green, false: theme.border }} />
          </View>

          {!!err && <Text style={{ color: theme.error, marginBottom: 10 }}>{err}</Text>}
          <Button title={initial ? 'Update Course' : 'Create Course'} testID="cm-save" onPress={save} loading={loading} full />
        </ScrollView>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 18, fontWeight: '900', color: theme.text },
  addBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: theme.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addTxt: { color: '#fff', fontWeight: '800' },
  card: { flexDirection: 'row', padding: 10, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  thumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: theme.surface2 },
  cName: { fontSize: 14, fontWeight: '800', color: theme.text },
  cMeta: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  statusPill: { fontSize: 10, color: '#fff', fontWeight: '800', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, overflow: 'hidden' },
  miniBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: theme.surface2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  miniTxt: { fontSize: 11, fontWeight: '800', color: theme.brand },
});
const modalSt = StyleSheet.create({
  overlay: { position: 'absolute', inset: 0 as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 18, fontWeight: '900', color: theme.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
