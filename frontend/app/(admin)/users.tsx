import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

export default function Users() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ username: '', email: '', full_name: '', phone: '', password: '', role: 'teacher' });

  const load = () => api.get('/users', { params: filter === 'all' ? {} : { role: filter } }).then(r => setItems(r.data));
  useEffect(() => { load(); }, [filter]);

  const create = async () => {
    try {
      await api.post('/users/create', f);
      setOpen(false); setF({ username: '', email: '', full_name: '', phone: '', password: '', role: 'teacher' }); load();
    } catch (e: any) { alert(e?.response?.data?.detail || 'Create failed'); }
  };
  const del = async (id: string) => { if (!confirm('Delete user?')) return; await api.delete(`/users/${id}`); load(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
        <Text style={st.title}>Manage Users</Text>
        <Pressable testID="users-add" onPress={() => setOpen(true)} style={st.addBtn}><Ionicons name="add" size={20} color="#fff" /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, padding: spacing.lg, paddingBottom: 0, flexWrap: 'wrap' }}>
        {(['all','student','teacher','admin'] as const).map(r => (
          <Pressable key={r} testID={`users-filter-${r}`} onPress={() => setFilter(r)} style={[st.chip, filter === r && st.chipOn]}>
            <Text style={[st.chipTxt, filter === r && { color: '#fff' }]}>{r.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 8, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{item.full_name}</Text>
              <Text style={st.meta}>@{item.username} • {item.email}</Text>
              <Text style={[st.pill, { backgroundColor: rolePill(item.role) }]}>{item.role?.toUpperCase()}</Text>
            </View>
            <Pressable testID={`user-del-${item.id}`} onPress={() => del(item.id)} hitSlop={10}><Ionicons name="trash" size={18} color={theme.error} /></Pressable>
          </View>
        )}
      />
      {open && (
        <View style={ms.overlay}>
          <View style={ms.sheet}>
            <View style={ms.head}><Text style={ms.title}>Create User</Text><Pressable onPress={() => setOpen(false)}><Ionicons name="close" size={22} color={theme.text} /></Pressable></View>
            <View style={{ padding: 16 }}>
              <Input testID="cu-name" label="Full Name" value={f.full_name} onChangeText={(v: string) => setF({ ...f, full_name: v })} />
              <Input testID="cu-username" label="Username" value={f.username} onChangeText={(v: string) => setF({ ...f, username: v })} autoCapitalize="none" />
              <Input testID="cu-email" label="Email" value={f.email} onChangeText={(v: string) => setF({ ...f, email: v })} keyboardType="email-address" />
              <Input testID="cu-phone" label="Phone" value={f.phone} onChangeText={(v: string) => setF({ ...f, phone: v })} />
              <Input testID="cu-pw" label="Password" value={f.password} onChangeText={(v: string) => setF({ ...f, password: v })} secureTextEntry />
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textMuted, marginBottom: 6 }}>Role</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['student','teacher','admin'] as const).map(r => (
                  <Pressable key={r} testID={`cu-role-${r}`} onPress={() => setF({ ...f, role: r })} style={[st.chip, f.role === r && st.chipOn]}>
                    <Text style={[st.chipTxt, f.role === r && { color: '#fff' }]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <Button title="Create User" testID="cu-save" onPress={create} full />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
const rolePill = (r: string) => r === 'super_admin' ? theme.brand : r === 'admin' ? theme.saffron : r === 'teacher' ? theme.green : theme.textSubtle;
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { flex: 1, fontSize: 16, fontWeight: '900', color: theme.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.brand, justifyContent: 'center', alignItems: 'center' },
  chip: { paddingHorizontal: 14, height: 32, justifyContent: 'center', borderRadius: 999, backgroundColor: theme.surface2 },
  chipOn: { backgroundColor: theme.brand },
  chipTxt: { fontSize: 12, color: theme.text, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  name: { fontSize: 14, fontWeight: '800', color: theme.text },
  meta: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  pill: { color: '#fff', fontSize: 10, fontWeight: '900', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, overflow: 'hidden' },
});
const ms = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 18, fontWeight: '900', color: theme.text },
});
