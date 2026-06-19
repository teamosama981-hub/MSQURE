import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';
import { Button } from '@/src/components/ui';

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<any>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enroll, setEnroll] = useState<any>(null);
  const [tab, setTab] = useState<'About' | 'Live' | 'Recordings' | 'Notes' | 'Tests' | 'Exams'>('About');
  const [live, setLive] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    api.get(`/courses/${id}`).then(r => setCourse(r.data));
    api.get('/enrollments/mine').then(r => {
      const e = r.data.find((x: any) => x.course_id === id);
      setEnrolled(!!e); setEnroll(e);
    }).catch(() => {});
    api.get('/live-classes', { params: { course_id: id } }).then(r => setLive(r.data)).catch(() => {});
    api.get('/recordings', { params: { course_id: id } }).then(r => setRecs(r.data)).catch(() => {});
    api.get('/notes', { params: { course_id: id } }).then(r => setNotes(r.data)).catch(() => {});
    api.get('/quizzes', { params: { course_id: id, kind: 'test' } }).then(r => setTests(r.data)).catch(() => {});
    api.get('/quizzes', { params: { course_id: id, kind: 'exam' } }).then(r => setExams(r.data)).catch(() => {});
  }, [id]);

  if (!course) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.brand} /></View>;

  const tryComplete = async () => {
    try { await api.post(`/courses/${id}/complete`); const r = await api.get('/enrollments/mine'); setEnroll(r.data.find((x: any) => x.course_id === id)); } catch (e: any) { alert(e?.response?.data?.detail || 'Cannot complete yet'); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={st.back}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={st.banner}>
          <Image source={{ uri: course.banner || course.thumbnail }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={["rgba(10,17,40,0.2)","rgba(10,17,40,0.85)"]} style={StyleSheet.absoluteFillObject} />
          <View style={st.bannerContent}>
            <Text style={st.cat}>{course.category}</Text>
            <Text style={st.title}>{course.name}</Text>
            <Text style={st.instructor}>by {course.instructor_name}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              <Meta i="time" t={course.duration} />
              <Meta i="film" t={`${course.num_classes} classes`} />
              <Meta i="globe" t={course.language} />
              {course.has_certificate !== false && <Meta i="ribbon" t="Certificate" />}
            </View>
          </View>
        </View>

        {/* Sticky tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 10, gap: 8 }}>
          {(['About','Live','Recordings','Notes','Tests','Exams'] as const).map(t => (
            <Pressable key={t} testID={`cd-tab-${t}`} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
              <Text style={[st.tabTxt, tab === t && { color: '#fff' }]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {tab === 'About' && (
            <>
              <Text style={st.section}>About this course</Text>
              <Text style={st.desc}>{course.description || 'No description provided.'}</Text>
              {enrolled && (
                <>
                  <Text style={st.section}>Your Progress</Text>
                  <View style={st.progCard}>
                    <View style={st.bar}><View style={[st.barF, { width: `${enroll?.progress_pct || 0}%` }]} /></View>
                    <Text style={st.progTxt}>{enroll?.progress_pct || 0}% complete</Text>
                    {!enroll?.completed_self && (enroll?.progress_pct || 0) >= 80 && (
                      <Button title="I HAVE COMPLETED THIS COURSE" testID="course-complete-btn" onPress={tryComplete} full />
                    )}
                    {enroll?.completed_self && <Text style={{ color: theme.green, fontWeight: '800', marginTop: 6 }}>✓ Course completed. Final exam unlocked.</Text>}
                  </View>
                </>
              )}
            </>
          )}
          {tab === 'Live' && (live.length === 0 ? <Empty t="No live classes yet" /> : live.map(l => <LiveRow key={l.id} item={l} />))}
          {tab === 'Recordings' && (recs.length === 0 ? <Empty t="No recordings yet" /> : recs.map(r => <RecRow key={r.id} item={r} enrolled={enrolled} />))}
          {tab === 'Notes' && (notes.length === 0 ? <Empty t="No notes yet" /> : notes.map(n => <NoteRow key={n.id} item={n} enrolled={enrolled} />))}
          {tab === 'Tests' && (tests.length === 0 ? <Empty t="No tests yet" /> : tests.map(q => <QuizRow key={q.id} item={q} enrolled={enrolled} />))}
          {tab === 'Exams' && (exams.length === 0 ? <Empty t="No exams yet" /> : exams.map(q => <QuizRow key={q.id} item={q} enrolled={enrolled} />))}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={st.cta}>
        {enrolled ? (
          <View style={st.enrolledCta}>
            <Ionicons name="checkmark-circle" size={22} color={theme.green} />
            <Text style={{ color: theme.green, fontWeight: '800' }}>You are enrolled</Text>
          </View>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: '700' }}>Price</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={st.price}>₹{course.discount_price || course.price}</Text>
                {!!course.discount_price && course.price !== course.discount_price && <Text style={st.priceCut}>₹{course.price}</Text>}
              </View>
            </View>
            <Button title="Enroll Now" testID="course-enroll-btn" onPress={() => router.push(`/payment/${id}` as any)} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const Meta = ({ i, t }: any) => <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Ionicons name={i} size={12} color="#fff" /><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{t}</Text></View>;
const Empty = ({ t }: any) => <Text style={{ color: theme.textMuted, fontSize: 13, marginVertical: 16, textAlign: 'center' }}>{t}</Text>;
const LiveRow = ({ item }: any) => <View style={st.lrow}><Text style={{ color: theme.text, fontWeight: '800' }}>{item.title}</Text><Text style={{ color: theme.textMuted, fontSize: 12 }}>{new Date(item.scheduled_at).toLocaleString()}</Text><Text style={{ fontSize: 11, fontWeight: '800', color: item.live_status === 'live' ? theme.green : theme.saffron }}>{item.live_status?.toUpperCase()}</Text></View>;
const RecRow = ({ item, enrolled }: any) => (
  <Pressable disabled={!enrolled} onPress={() => router.push(`/recording/${item.id}` as any)} style={[st.lrow, !enrolled && { opacity: 0.5 }]} testID={`cd-rec-${item.id}`}>
    <Ionicons name="play-circle" size={22} color={theme.brand} />
    <Text style={{ color: theme.text, fontWeight: '700', flex: 1, marginLeft: 8 }}>{item.title}</Text>
    {!enrolled && <Ionicons name="lock-closed" size={16} color={theme.textSubtle} />}
  </Pressable>
);
const NoteRow = ({ item, enrolled }: any) => (
  <Pressable disabled={!enrolled} onPress={() => router.push(`/note/${item.id}` as any)} style={[st.lrow, !enrolled && { opacity: 0.5 }]} testID={`cd-note-${item.id}`}>
    <Ionicons name="document" size={22} color={theme.brand} />
    <Text style={{ color: theme.text, fontWeight: '700', flex: 1, marginLeft: 8 }}>{item.title}</Text>
    {!enrolled && <Ionicons name="lock-closed" size={16} color={theme.textSubtle} />}
  </Pressable>
);
const QuizRow = ({ item, enrolled }: any) => (
  <Pressable disabled={!enrolled} onPress={() => router.push(`/quiz/${item.id}` as any)} style={[st.lrow, !enrolled && { opacity: 0.5 }]} testID={`cd-quiz-${item.id}`}>
    <Ionicons name="clipboard" size={22} color={theme.brand} />
    <View style={{ flex: 1, marginLeft: 8 }}>
      <Text style={{ color: theme.text, fontWeight: '700' }}>{item.title}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 11 }}>{item.questions?.length} Qs • {item.duration_min} min</Text>
    </View>
    {!enrolled && <Ionicons name="lock-closed" size={16} color={theme.textSubtle} />}
  </Pressable>
);

const st = StyleSheet.create({
  back: { position: 'absolute', top: 50, left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  banner: { height: 280, justifyContent: 'flex-end' },
  bannerContent: { padding: 20 },
  cat: { color: theme.saffron, fontSize: 12, fontWeight: '900' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 4 },
  instructor: { color: '#E6EAFA', fontSize: 13, marginTop: 4 },
  tab: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, flexShrink: 0 },
  tabOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  tabTxt: { fontSize: 13, color: theme.text, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '900', color: theme.text, marginTop: 12 },
  desc: { fontSize: 14, color: theme.textMuted, lineHeight: 22, marginTop: 6 },
  progCard: { marginTop: 8, padding: 14, backgroundColor: theme.surface2, borderRadius: 14 },
  bar: { height: 8, borderRadius: 4, backgroundColor: theme.surface3, overflow: 'hidden' },
  barF: { height: 8, backgroundColor: theme.green },
  progTxt: { color: theme.text, fontWeight: '800', marginTop: 6 },
  lrow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, marginVertical: 4 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  enrolledCta: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  price: { fontSize: 22, fontWeight: '900', color: theme.green },
  priceCut: { fontSize: 13, color: theme.textSubtle, textDecorationLine: 'line-through' },
});
