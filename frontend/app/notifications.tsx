import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api.get('/notifications').then(r => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const markAll = async () => { await api.post('/notifications/read-all'); load(); };
  const tap = async (n: any) => {
    if (!n.read) { try { await api.post(`/notifications/${n.id}/read`); } catch {} }
    load();
    if (n.link) router.push(n.link as any);
  };
  const color = (k: string) => k === 'success' ? theme.green : k === 'error' ? theme.error : k === 'warning' || k === 'cancel' ? theme.saffron : theme.brand;
  const icon = (k: string): any => k === 'success' ? 'checkmark-circle' : k === 'error' ? 'close-circle' : k === 'warning' || k === 'cancel' ? 'warning' : 'information-circle';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
        <Text style={st.headT}>Notifications</Text>
        <Pressable testID="notif-mark-all" onPress={markAll}><Text style={{ color: theme.brand, fontWeight: '800' }}>Mark all read</Text></Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={<View style={{ alignItems: 'center', padding: 40 }}><Ionicons name="notifications-off" size={48} color={theme.textSubtle} /><Text style={{ color: theme.textMuted, marginTop: 10, fontWeight: '700' }}>No notifications yet</Text></View>}
        renderItem={({ item }) => (
          <Pressable testID={`notif-${item.id}`} onPress={() => tap(item)} style={[st.card, !item.read && { borderLeftWidth: 4, borderLeftColor: color(item.kind) }]}>
            <Ionicons name={icon(item.kind)} size={22} color={color(item.kind)} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[st.title, !item.read && { fontWeight: '900' }]}>{item.title}</Text>
              <Text style={st.body}>{item.body}</Text>
              <Text style={st.time}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  headT: { fontSize: 16, fontWeight: '900', color: theme.text },
  card: { flexDirection: 'row', padding: 12, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  title: { fontSize: 14, fontWeight: '700', color: theme.text },
  body: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  time: { fontSize: 10, color: theme.textSubtle, marginTop: 4, fontWeight: '700' },
});
