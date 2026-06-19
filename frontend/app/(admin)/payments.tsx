import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';
import { Button } from '@/src/components/ui';

export default function AdminPayments() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [items, setItems] = useState<any[]>([]);
  const load = () => api.get(tab === 'pending' ? '/payments/pending' : '/payments/all').then(r => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, [tab]);

  const decide = async (id: string, approve: boolean) => {
    const reason = approve ? '' : prompt('Reason for rejection?') || '';
    await api.post('/payments/verify', { payment_id: id, approve, reason });
    load();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Text style={st.title}>Payment Verifications</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 10 }}>
        {(['pending','all'] as const).map(t => (
          <Pressable key={t} testID={`pay-tab-${t}`} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
            <Text style={[st.tabTxt, tab === t && { color: '#fff' }]}>{t === 'pending' ? 'Pending' : 'All'}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textMuted, padding: 40 }}>No payments</Text>}
        renderItem={({ item }) => {
          const color = item.status === 'approved' ? theme.green : item.status === 'rejected' ? theme.error : theme.saffron;
          return (
            <View style={st.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={st.user}>{item.user_name}</Text>
                <Text style={[st.pill, { backgroundColor: color }]}>{(item.status || '').toUpperCase()}</Text>
              </View>
              <Text style={st.course}>{item.course_name}</Text>
              <View style={st.metaRow}>
                <Meta k="Amount" v={`₹${item.amount}`} />
                <Meta k="Method" v={(item.method || '').toUpperCase()} />
                <Meta k="UTR" v={item.utr || '-'} />
              </View>
              <Text style={st.sub}>{new Date(item.created_at).toLocaleString()}</Text>
              <Text style={st.sub}>📧 {item.user_email || '-'} • 📞 {item.user_phone || '-'}</Text>
              {item.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <Button title="Approve & Enroll" testID={`pay-approve-${item.id}`} small onPress={() => decide(item.id, true)} />
                  <Button title="Reject" testID={`pay-reject-${item.id}`} small variant="outline" onPress={() => decide(item.id, false)} />
                </View>
              )}
              {!!item.verified_by && <Text style={st.sub}>Verified by: {item.verified_by}{item.rejection_reason ? ` • Reason: ${item.rejection_reason}` : ''}</Text>}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
const Meta = ({ k, v }: any) => (
  <View><Text style={st.metaK}>{k}</Text><Text style={st.metaV}>{v}</Text></View>
);

const st = StyleSheet.create({
  head: { paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 18, fontWeight: '900', color: theme.text },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.surface2 },
  tabOn: { backgroundColor: theme.brand },
  tabTxt: { color: theme.text, fontWeight: '800', fontSize: 13 },
  card: { padding: 14, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  user: { fontSize: 15, fontWeight: '900', color: theme.text },
  course: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  pill: { color: '#fff', fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  metaRow: { flexDirection: 'row', gap: 20, marginTop: 10 },
  metaK: { fontSize: 10, color: theme.textSubtle, fontWeight: '800' },
  metaV: { fontSize: 12, color: theme.text, fontWeight: '700' },
  sub: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
});
