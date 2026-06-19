import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, FlatList, RefreshControl, Linking } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, apiUrl } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

const TABS = ['Courses', 'Live', 'Recordings', 'Notes', 'Tests', 'Assignments', 'Exams', 'Certificates', 'Payments'] as const;
type Tab = typeof TABS[number];

export default function MyStudy() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial = (() => {
    const t = (params.tab || '').toLowerCase();
    const m: any = { live: 'Live', recordings: 'Recordings', notes: 'Notes', certificates: 'Certificates', payments: 'Payments' };
    return m[t] || 'Courses';
  })();
  const [tab, setTab] = useState<Tab>(initial);
  const [enrolls, setEnrolls] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/enrollments/mine'); setEnrolls(r.data); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Text style={st.title}>My Study</Text>
      </View>
      <View style={{ height: 52 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 8 }}>
          {TABS.map(t => (
            <Pressable key={t} testID={`mystudy-tab-${t}`} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
              <Text style={[st.tabTxt, tab === t && st.tabTxtOn]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {tab === 'Courses' && <CoursesTab data={enrolls} refresh={refresh} onRefresh={async () => { setRefresh(true); await load(); setRefresh(false); }} />}
      {tab === 'Live' && <LiveTab enrolls={enrolls} />}
      {tab === 'Recordings' && <ItemListTab enrolls={enrolls} kind="recordings" />}
      {tab === 'Notes' && <ItemListTab enrolls={enrolls} kind="notes" />}
      {tab === 'Tests' && <QuizListTab enrolls={enrolls} kind="test" />}
      {tab === 'Assignments' && <QuizListTab enrolls={enrolls} kind="assignment" />}
      {tab === 'Exams' && <QuizListTab enrolls={enrolls} kind="exam" />}
      {tab === 'Certificates' && <CertificatesTab />}
      {tab === 'Payments' && <PaymentsTab />}
    </SafeAreaView>
  );
}

const CoursesTab = ({ data, refresh, onRefresh }: any) => (
  <FlatList
    data={data}
    keyExtractor={(i) => i.id}
    refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} />}
    contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: 12 }}
    ListEmptyComponent={<Empty icon="book" t="No courses yet" s="Enroll in a course to start learning." />}
    renderItem={({ item }) => (
      <Pressable testID={`mystudy-course-${item.course_id}`} onPress={() => router.push(`/course/${item.course_id}` as any)} style={st.crow}>
        <Image source={{ uri: item.course?.thumbnail }} style={st.cthumb} contentFit="cover" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={st.cTitle}>{item.course?.name}</Text>
          <Text style={st.cInstr}>{item.course?.instructor_name}</Text>
          <View style={st.bar}><View style={[st.barF, { width: `${item.progress_pct || 0}%` }]} /></View>
          <Text style={st.barTxt}>{item.progress_pct || 0}% complete</Text>
        </View>
      </Pressable>
    )}
  />
);

const LiveTab = ({ enrolls }: any) => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    Promise.all(enrolls.map((e: any) => api.get('/live-classes', { params: { course_id: e.course_id } }).then(r => r.data).catch(() => [])))
      .then(arr => setItems(arr.flat().sort((a: any, b: any) => (a.scheduled_at < b.scheduled_at ? 1 : -1))));
  }, [enrolls]);
  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: 12 }}
      ListEmptyComponent={<Empty icon="videocam" t="No live classes scheduled" s="Teachers will schedule live classes here." />}
      renderItem={({ item }) => {
        const when = new Date(item.scheduled_at).toLocaleString();
        const live = item.live_status === 'live';
        const upcoming = item.live_status === 'upcoming';
        return (
          <View testID={`live-${item.id}`} style={st.liveCard}>
            <View style={[st.liveBadge, { backgroundColor: live ? theme.green : upcoming ? theme.saffron : theme.textSubtle }]}>
              <Text style={st.liveBadgeTxt}>{live ? '● LIVE NOW' : upcoming ? 'UPCOMING' : 'ENDED'}</Text>
            </View>
            <Text style={st.liveTitle}>{item.title}</Text>
            <Text style={st.liveWhen}>📅 {when}</Text>
            {!!item.description && <Text style={st.liveDesc}>{item.description}</Text>}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <Pressable
                testID={`live-go-${item.id}`}
                disabled={!item.can_join}
                onPress={() => Linking.openURL(item.teams_link)}
                style={[st.goBtn, !item.can_join && { backgroundColor: theme.surface3 }]}
              >
                <Ionicons name="videocam" size={18} color={item.can_join ? '#fff' : theme.textSubtle} />
                <Text style={[st.goBtnTxt, !item.can_join && { color: theme.textSubtle }]}>
                  {item.can_join ? 'Go Live (Join MS Teams)' : upcoming ? 'Available at scheduled time' : 'Class ended'}
                </Text>
              </Pressable>
              {item.can_join && (
                <Pressable testID={`live-link-${item.id}`} onPress={() => Linking.openURL(item.teams_link)} style={st.copyLink}>
                  <Text style={st.copyLinkTxt} numberOfLines={1}>{item.teams_link}</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      }}
    />
  );
};

const ItemListTab = ({ enrolls, kind }: any) => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    Promise.all(enrolls.map((e: any) =>
      api.get(`/${kind}`, { params: { course_id: e.course_id } }).then(r => r.data.map((x: any) => ({ ...x, course: e.course }))).catch(() => [])
    )).then(arr => setItems(arr.flat()));
  }, [enrolls, kind]);

  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: 10 }}
      ListEmptyComponent={<Empty icon={kind === 'recordings' ? 'play-circle' : 'document-text'} t={`No ${kind} yet`} s="Items uploaded by your teachers will appear here." />}
      renderItem={({ item }) => kind === 'recordings' ? (
        <Pressable testID={`rec-${item.id}`} onPress={() => router.push(`/recording/${item.id}` as any)} style={st.recCard}>
          <Image source={{ uri: item.thumbnail }} style={st.recThumb} contentFit="cover" />
          <View style={st.playOverlay}><Ionicons name="play" size={28} color="#fff" /></View>
          <View style={{ padding: 10 }}>
            <Text style={st.recTitle}>{item.title}</Text>
            <Text style={st.recSub}>{item.course?.name} • {item.duration_min || 0} min</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable testID={`note-${item.id}`} onPress={() => router.push(`/note/${item.id}` as any)} style={st.noteCard}>
          <View style={st.fileIco}><Ionicons name="document" size={22} color={theme.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.recTitle}>{item.title}</Text>
            <Text style={st.recSub}>{item.course?.name} • {item.file_type?.toUpperCase()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSubtle} />
        </Pressable>
      )}
    />
  );
};

const QuizListTab = ({ enrolls, kind }: any) => {
  const [items, setItems] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([
      ...enrolls.map((e: any) => api.get('/quizzes', { params: { course_id: e.course_id, kind } }).then(r => r.data.map((x: any) => ({ ...x, course: e.course }))).catch(() => [])),
    ]).then(arr => setItems(arr.flat()));
    api.get('/submissions/mine').then(r => setSubs(r.data)).catch(() => {});
  }, [enrolls, kind]);
  const subFor = (qid: string) => subs.find(s => s.quiz_id === qid);

  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: 10 }}
      ListEmptyComponent={<Empty icon="clipboard" t={`No ${kind}s`} s="Your teacher will publish them soon." />}
      renderItem={({ item }) => {
        const s = subFor(item.id);
        const done = !!s;
        return (
          <Pressable testID={`quiz-${item.id}`} onPress={() => router.push(`/quiz/${item.id}` as any)} style={st.quizCard}>
            <View style={[st.quizIco, { backgroundColor: done ? '#E8FBEE' : '#E6EAFA' }]}>
              <Ionicons name={done ? 'checkmark-circle' : 'help-circle'} size={24} color={done ? theme.green : theme.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.recTitle}>{item.title}</Text>
              <Text style={st.recSub}>{item.course?.name} • {item.questions?.length || 0} Qs • {item.duration_min} min</Text>
              {done && <Text style={[st.recSub, { color: theme.green, fontWeight: '800' }]}>✓ Completed — {s.percentage?.toFixed(0)}%</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSubtle} />
          </Pressable>
        );
      }}
    />
  );
};

const CertificatesTab = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/certificates/mine').then(r => setItems(r.data)).catch(() => {}); }, []);
  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: 12 }}
      ListEmptyComponent={<Empty icon="ribbon" t="No certificates yet" s="Pass a course final exam (≥60%) to earn a verified certificate." />}
      renderItem={({ item }) => (
        <View testID={`cert-${item.id}`} style={st.certCard}>
          <View style={{ flex: 1 }}>
            <Text style={st.certName}>{item.course_name}</Text>
            <Text style={st.certSub}>Certificate ID: {item.id}</Text>
            <Text style={st.certSub}>Score: {item.score?.toFixed(1)}% • Issued {new Date(item.issued_at).toLocaleDateString()}</Text>
            <Pressable testID={`cert-verify-${item.id}`} onPress={() => router.push(`/verify/${item.id}` as any)} style={st.verifyBtn}>
              <Ionicons name="qr-code" size={16} color="#fff" />
              <Text style={st.verifyBtnTxt}>View QR & Verify</Text>
            </Pressable>
          </View>
          <Image source={{ uri: apiUrl(`/certificates/${item.id}/qr.png`) }} style={st.qr} contentFit="contain" />
        </View>
      )}
    />
  );
};

const PaymentsTab = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/payments/mine').then(r => setItems(r.data)).catch(() => {}); }, []);
  const color = (s: string) => s === 'approved' ? theme.green : s === 'rejected' ? theme.error : theme.saffron;
  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: 10 }}
      ListEmptyComponent={<Empty icon="receipt" t="No payment history" s="Your transactions will appear here." />}
      renderItem={({ item }) => (
        <View testID={`pay-${item.id}`} style={st.payCard}>
          <View style={{ flex: 1 }}>
            <Text style={st.recTitle}>{item.course_name}</Text>
            <Text style={st.recSub}>{item.method?.toUpperCase()} • {new Date(item.created_at).toLocaleString()}</Text>
            {!!item.utr && <Text style={st.recSub}>UTR: {item.utr}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.recTitle, { color: color(item.status) }]}>₹{item.amount}</Text>
            <Text style={[st.statusPill, { backgroundColor: color(item.status) }]}>{item.status?.toUpperCase()}</Text>
          </View>
        </View>
      )}
    />
  );
};

const Empty = ({ icon, t, s }: any) => (
  <View style={st.empty}>
    <Ionicons name={icon} size={48} color={theme.textSubtle} />
    <Text style={st.emptyT}>{t}</Text>
    <Text style={st.emptyS}>{s}</Text>
  </View>
);

const st = StyleSheet.create({
  head: { paddingHorizontal: spacing.lg, paddingVertical: 8 },
  title: { fontSize: 22, fontWeight: '900', color: theme.text },
  tab: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, flexShrink: 0 },
  tabOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  tabTxt: { fontSize: 13, color: theme.text, fontWeight: '700' },
  tabTxtOn: { color: '#fff' },
  crow: { flexDirection: 'row', padding: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16 },
  cthumb: { width: 90, height: 90, borderRadius: 12, backgroundColor: theme.surface2 },
  cTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  cInstr: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  bar: { height: 6, borderRadius: 4, backgroundColor: theme.surface3, marginTop: 8, overflow: 'hidden' },
  barF: { height: 6, backgroundColor: theme.green },
  barTxt: { fontSize: 11, color: theme.textMuted, marginTop: 4, fontWeight: '700' },
  liveCard: { backgroundColor: theme.surface, padding: spacing.lg, borderRadius: 18, borderWidth: 1, borderColor: theme.border },
  liveBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  liveBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  liveTitle: { fontSize: 17, fontWeight: '900', color: theme.text, marginTop: 8 },
  liveWhen: { fontSize: 13, color: theme.textMuted, marginTop: 4, fontWeight: '600' },
  liveDesc: { fontSize: 13, color: theme.textMuted, marginTop: 6 },
  goBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.brand, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  goBtnTxt: { color: '#fff', fontWeight: '800' },
  copyLink: { flex: 1, minWidth: 100, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: theme.surface2, borderRadius: 12 },
  copyLinkTxt: { fontSize: 11, color: theme.brand, fontWeight: '700' },
  recCard: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  recThumb: { width: '100%', height: 160, backgroundColor: theme.surface2 },
  playOverlay: { position: 'absolute', top: 60, alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  recTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  recSub: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  fileIco: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E6EAFA', justifyContent: 'center', alignItems: 'center' },
  quizCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  quizIco: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  certCard: { flexDirection: 'row', gap: 12, padding: spacing.lg, backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border },
  certName: { fontSize: 15, fontWeight: '900', color: theme.text },
  certSub: { fontSize: 11, color: theme.textMuted, marginTop: 3 },
  qr: { width: 80, height: 80, backgroundColor: theme.surface2, borderRadius: 8 },
  verifyBtn: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', marginTop: 10, backgroundColor: theme.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  verifyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  payCard: { flexDirection: 'row', padding: 12, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  statusPill: { color: '#fff', fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, overflow: 'hidden' },
  empty: { alignItems: 'center', padding: 50, gap: 8 },
  emptyT: { fontSize: 16, fontWeight: '800', color: theme.text },
  emptyS: { fontSize: 13, color: theme.textMuted, textAlign: 'center' },
});
