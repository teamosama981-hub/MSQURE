import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/lib/auth';
import { theme, spacing, LOGO_URL } from '@/src/lib/theme';

const W = Dimensions.get('window').width;

export default function Home() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolls, setEnrolls] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, e, n] = await Promise.all([
        api.get('/courses'),
        api.get('/enrollments/mine'),
        api.get('/notifications'),
      ]);
      setCourses(c.data); setEnrolls(e.data);
      setUnread(n.data.filter((x: any) => !x.read).length);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefresh(true); await load(); setRefresh(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.header}>
        <Image source={{ uri: LOGO_URL }} style={{ width: 42, height: 42 }} contentFit="contain" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={st.greeting}>Hi, {user?.full_name?.split(' ')[0] || 'Student'} 👋</Text>
          <Text style={st.sub}>Let's keep learning today</Text>
        </View>
        <Pressable testID="home-bell" onPress={() => router.push('/notifications' as any)} style={st.bell}>
          <Ionicons name="notifications-outline" size={22} color={theme.brand} />
          {unread > 0 && <View style={st.dot}><Text style={st.dotTxt}>{unread}</Text></View>}
        </Pressable>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} />} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero banner */}
        <Pressable testID="home-hero" onPress={() => router.push('/(student)/browse' as any)} style={st.hero}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1637589308599-3478cc55510d?w=1200' }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={["rgba(10,17,40,0.1)","rgba(10,17,40,0.85)"]} style={StyleSheet.absoluteFillObject} />
          <View style={{ padding: 18 }}>
            <Text style={st.heroTag}>EDUCATE • EMPOWER • ELEVATE</Text>
            <Text style={st.heroTitle}>Explore courses curated for your goals</Text>
            <View style={st.heroBtn}><Text style={st.heroBtnTxt}>Browse all →</Text></View>
          </View>
        </Pressable>

        {/* Continue learning */}
        {enrolls.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={st.section}>Continue learning</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}>
              {enrolls.map(en => (
                <Pressable key={en.id} testID={`enrolled-${en.course_id}`} onPress={() => router.push(`/course/${en.course_id}` as any)} style={st.contCard}>
                  <Image source={{ uri: en.course?.thumbnail }} style={st.contThumb} contentFit="cover" />
                  <View style={{ padding: 10 }}>
                    <Text style={st.contTitle} numberOfLines={1}>{en.course?.name}</Text>
                    <View style={st.barBg}><View style={[st.bar, { width: `${en.progress_pct || 0}%` }]} /></View>
                    <Text style={st.barTxt}>{en.progress_pct || 0}% complete</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick links */}
        <View style={st.quickRow}>
          {[
            { i: 'videocam', l: 'Live Classes', t: 'live', testID: 'home-quick-live' },
            { i: 'play-circle', l: 'Recordings', t: 'recordings', testID: 'home-quick-rec' },
            { i: 'document-text', l: 'Notes', t: 'notes', testID: 'home-quick-notes' },
            { i: 'ribbon', l: 'Certificates', t: 'certificates', testID: 'home-quick-cert' },
          ].map(q => (
            <Pressable key={q.l} testID={q.testID} onPress={() => router.push(`/(student)/my-study?tab=${q.t}` as any)} style={st.quick}>
              <View style={st.qIcon}><Ionicons name={q.i as any} size={22} color={theme.brand} /></View>
              <Text style={st.qLbl}>{q.l}</Text>
            </Pressable>
          ))}
        </View>

        {/* Featured */}
        <View style={{ marginTop: spacing.md }}>
          <View style={st.sectHead}>
            <Text style={st.section}>Featured courses</Text>
            <Pressable testID="home-all-courses" onPress={() => router.push('/(student)/browse' as any)}>
              <Text style={{ color: theme.brand, fontWeight: '700' }}>See all →</Text>
            </Pressable>
          </View>
          {courses.slice(0, 5).map(c => (
            <Pressable key={c.id} testID={`home-course-${c.id}`} onPress={() => router.push(`/course/${c.id}` as any)} style={st.row}>
              <Image source={{ uri: c.thumbnail }} style={st.rowThumb} contentFit="cover" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={st.pill}>{c.category}</Text>
                <Text style={st.rowTitle} numberOfLines={2}>{c.name}</Text>
                <Text style={st.rowInstr}>by {c.instructor_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <Text style={st.price}>₹{c.discount_price || c.price}</Text>
                  {!!c.discount_price && c.price !== c.discount_price && <Text style={st.priceCut}>₹{c.price}</Text>}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  greeting: { fontSize: 16, fontWeight: '900', color: theme.text },
  sub: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface2, justifyContent: 'center', alignItems: 'center' },
  dot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: theme.saffron, justifyContent: 'center', alignItems: 'center' },
  dotTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  hero: { height: 180, margin: spacing.lg, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  heroTag: { color: theme.saffron, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 6 },
  heroBtn: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroBtnTxt: { color: '#fff', fontWeight: '800' },
  section: { fontSize: 17, fontWeight: '900', color: theme.text, paddingHorizontal: spacing.lg, marginVertical: 8 },
  sectHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  contCard: { width: 220, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  contThumb: { width: '100%', height: 110, backgroundColor: theme.surface2 },
  contTitle: { fontSize: 13, fontWeight: '800', color: theme.text },
  barBg: { height: 6, borderRadius: 4, backgroundColor: theme.surface3, marginTop: 8, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: theme.green },
  barTxt: { fontSize: 11, color: theme.textMuted, marginTop: 4, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  quick: { flex: 1, backgroundColor: theme.surface2, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  qIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6EAFA', justifyContent: 'center', alignItems: 'center' },
  qLbl: { fontSize: 11, fontWeight: '800', color: theme.text, marginTop: 6 },
  row: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 16, padding: 10, marginHorizontal: spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  rowThumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: theme.surface2 },
  pill: { fontSize: 10, color: theme.saffron, fontWeight: '800' },
  rowTitle: { fontSize: 14, fontWeight: '800', color: theme.text, marginTop: 2 },
  rowInstr: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '900', color: theme.green },
  priceCut: { fontSize: 11, color: theme.textSubtle, textDecorationLine: 'line-through' },
});
