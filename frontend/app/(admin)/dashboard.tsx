import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/lib/auth';
import { theme, spacing, LOGO_URL } from '@/src/lib/theme';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>({});
  const [refresh, setRefresh] = useState(false);
  const load = useCallback(async () => {
    try { const r = await api.get('/analytics/overview'); setStats(r.data); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const isSuper = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuper;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Image source={{ uri: LOGO_URL }} style={{ width: 40, height: 40 }} contentFit="contain" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={st.greet}>{user?.role?.replace('_', ' ').toUpperCase()} PANEL</Text>
          <Text style={st.name}>{user?.full_name}</Text>
        </View>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text style={st.section}>Overview</Text>
        <View style={st.statGrid}>
          <StatCard t="Total Students" v={stats.total_students || 0} i="people" color={theme.brand} />
          <StatCard t="Teachers" v={stats.total_teachers || 0} i="school" color={theme.saffron} />
          <StatCard t="Courses" v={stats.total_courses || 0} i="book" color={theme.green} />
          <StatCard t="Pending Payments" v={stats.pending_payments || 0} i="time" color={theme.error} />
          <StatCard t="Certificates" v={stats.total_certificates || 0} i="ribbon" color={theme.brand} />
          <StatCard t="Month Revenue" v={`₹${(stats.month_revenue || 0).toFixed(0)}`} i="trending-up" color={theme.green} />
        </View>
        <View style={st.totalCard}>
          <Text style={st.totalLbl}>TOTAL REVENUE</Text>
          <Text style={st.totalAmt}>₹{(stats.total_revenue || 0).toFixed(0)}</Text>
        </View>

        <Text style={st.section}>Quick Actions</Text>
        <View style={{ gap: 8 }}>
          <ActionBtn icon="add-circle" t="Manage Courses" onPress={() => router.push('/(admin)/courses' as any)} testID="quick-courses" />
          {isAdmin && <ActionBtn icon="cash" t="Verify Payments" onPress={() => router.push('/(admin)/payments' as any)} testID="quick-pay" />}
          {isAdmin && <ActionBtn icon="ribbon" t="Certificate QR Library" onPress={() => router.push('/(admin)/certificates' as any)} testID="quick-certs" />}
          {isAdmin && <ActionBtn icon="megaphone" t="Send Announcement" onPress={() => router.push('/(admin)/announcement' as any)} testID="quick-annc" />}
          {isSuper && <ActionBtn icon="people" t="Manage Users (Admins/Teachers)" onPress={() => router.push('/(admin)/users' as any)} testID="quick-users" />}
          {isSuper && <ActionBtn icon="settings" t="Razorpay & UPI Settings" onPress={() => router.push('/(admin)/settings' as any)} testID="quick-settings" />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard = ({ t, v, i, color }: any) => (
  <View style={st.statCard}>
    <View style={[st.statIcon, { backgroundColor: color + '22' }]}><Ionicons name={i} size={18} color={color} /></View>
    <Text style={st.statV}>{v}</Text>
    <Text style={st.statT}>{t}</Text>
  </View>
);

const ActionBtn = ({ icon, t, onPress, testID }: any) => (
  <Pressable testID={testID} onPress={onPress} style={st.aBtn}>
    <Ionicons name={icon} size={22} color={theme.brand} />
    <Text style={st.aTxt}>{t}</Text>
    <Ionicons name="chevron-forward" size={18} color={theme.textSubtle} />
  </Pressable>
);

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  greet: { fontSize: 10, color: theme.saffron, fontWeight: '900', letterSpacing: 0.6 },
  name: { fontSize: 16, fontWeight: '900', color: theme.text, marginTop: 2 },
  section: { fontSize: 13, fontWeight: '900', color: theme.textMuted, letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '30%', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, gap: 6 },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statV: { fontSize: 18, fontWeight: '900', color: theme.text },
  statT: { fontSize: 11, color: theme.textMuted, fontWeight: '700' },
  totalCard: { marginTop: 12, backgroundColor: theme.brand, padding: 16, borderRadius: 16 },
  totalLbl: { color: '#A3B6F5', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  totalAmt: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 4 },
  aBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  aTxt: { flex: 1, color: theme.text, fontWeight: '700' },
});
