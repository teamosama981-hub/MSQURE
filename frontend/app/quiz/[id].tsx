import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';
import { Button } from '@/src/components/ui';

export default function QuizPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quiz, setQuiz] = useState<any>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/quizzes/${id}`).then(r => { setQuiz(r.data); setRemaining((r.data.duration_min || 30) * 60); })
      .catch(e => setError(e?.response?.data?.detail || 'Cannot load quiz'));
  }, [id]);

  useEffect(() => {
    if (!quiz || result) return;
    const t = setInterval(() => setRemaining(s => { if (s <= 1) { submit(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz, result]);

  const submit = async () => {
    if (submitting || result) return;
    setSubmitting(true);
    try {
      const r = await api.post('/quizzes/submit', { quiz_id: id, answers });
      setResult(r.data);
    } catch (e: any) { setError(e?.response?.data?.detail || 'Submission failed'); }
    finally { setSubmitting(false); }
  };

  if (error) return <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface, justifyContent: 'center', padding: 24 }}>
    <Ionicons name="alert-circle" size={48} color={theme.error} style={{ alignSelf: 'center' }} />
    <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 12 }}>{error}</Text>
    <View style={{ marginTop: 20 }}><Button title="Go Back" testID="quiz-back" onPress={() => router.back()} full /></View>
  </SafeAreaView>;

  if (!quiz) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.brand} /></View>;

  if (result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, alignItems: 'center' }}>
          <View style={[st.resultIcon, { backgroundColor: result.percentage >= 60 ? '#E8FBEE' : '#FCEBED' }]}>
            <Ionicons name={result.percentage >= 60 ? 'trophy' : 'school'} size={56} color={result.percentage >= 60 ? theme.green : theme.error} />
          </View>
          <Text style={st.resultTitle}>{quiz.title} - Completed</Text>
          <Text style={st.resultPct}>{result.percentage.toFixed(0)}%</Text>
          <Text style={st.resultScore}>Score: {result.score.toFixed(1)} / {result.total}</Text>
          <Text style={st.resultMsg}>{result.percentage >= 60 ? '🎉 Excellent work! You passed.' : 'Keep practicing — you can retry.'}</Text>
          {quiz.kind === 'exam' && result.percentage >= 60 && (
            <Text style={[st.resultMsg, { color: theme.green, fontWeight: '900' }]}>🏆 Certificate generated! Check My Study → Certificates.</Text>
          )}
          <View style={{ marginTop: 24, width: '100%', gap: 10 }}>
            <Button title="Back to My Study" testID="result-back" onPress={() => router.replace('/(student)/my-study' as any)} full />
            <Button title="Retry" variant="outline" testID="result-retry" onPress={() => { setResult(null); setAnswers({}); setIdx(0); setRemaining((quiz.duration_min || 30) * 60); }} full />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const q = quiz.questions[idx];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const setSingle = (i: number) => setAnswers({ ...answers, [q.id]: i });
  const toggleMulti = (i: number) => {
    const cur: number[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
    setAnswers({ ...answers, [q.id]: cur.includes(i) ? cur.filter((x: number) => x !== i) : [...cur, i] });
  };
  const setInt = (v: string) => setAnswers({ ...answers, [q.id]: parseInt(v || '0', 10) });
  const answered = Object.keys(answers).filter(k => answers[k] !== undefined).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="close" size={24} color={theme.text} /></Pressable>
        <View>
          <Text style={st.headT} numberOfLines={1}>{quiz.title}</Text>
          <Text style={st.headS}>{quiz.kind?.toUpperCase()} • {answered}/{quiz.questions.length} answered</Text>
        </View>
        <View style={st.timer}>
          <Ionicons name="time" size={14} color="#fff" />
          <Text style={st.timerTxt}>{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={st.qNum}>Question {idx + 1} of {quiz.questions.length}</Text>
        <Text style={st.qText}>{q.text}</Text>
        <Text style={st.qType}>
          {q.q_type === 'single' && '• Choose ONE correct option'}
          {q.q_type === 'multiple' && '• Choose ALL correct options'}
          {q.q_type === 'integer' && '• Enter an integer answer'}
        </Text>

        {q.q_type === 'single' && (q.options || []).map((opt: string, i: number) => (
          <Pressable key={i} testID={`q-opt-${i}`} onPress={() => setSingle(i)} style={[st.opt, answers[q.id] === i && st.optOn]}>
            <View style={[st.radio, answers[q.id] === i && st.radioOn]}>{answers[q.id] === i && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
            <Text style={st.optTxt}>{opt}</Text>
          </Pressable>
        ))}
        {q.q_type === 'multiple' && (q.options || []).map((opt: string, i: number) => {
          const sel = Array.isArray(answers[q.id]) && (answers[q.id] as number[]).includes(i);
          return (
            <Pressable key={i} testID={`q-mopt-${i}`} onPress={() => toggleMulti(i)} style={[st.opt, sel && st.optOn]}>
              <View style={[st.check, sel && st.checkOn]}>{sel && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
              <Text style={st.optTxt}>{opt}</Text>
            </Pressable>
          );
        })}
        {q.q_type === 'integer' && (
          <View style={st.intBox}>
            <TextInput
              testID="q-int-input"
              value={String(answers[q.id] ?? '')}
              onChangeText={setInt}
              keyboardType="number-pad"
              placeholder="Enter integer answer"
              placeholderTextColor={theme.textSubtle}
              style={st.intInp}
            />
          </View>
        )}
      </ScrollView>

      <View style={st.cta}>
        <Pressable testID="q-prev" disabled={idx === 0} onPress={() => setIdx(i => Math.max(0, i - 1))} style={[st.navBtn, idx === 0 && { opacity: 0.4 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.brand} />
          <Text style={st.navTxt}>Previous</Text>
        </Pressable>
        {idx < quiz.questions.length - 1 ? (
          <Pressable testID="q-next" onPress={() => setIdx(i => Math.min(quiz.questions.length - 1, i + 1))} style={[st.navBtn, { backgroundColor: theme.brand }]}>
            <Text style={[st.navTxt, { color: '#fff' }]}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable testID="q-submit" disabled={submitting} onPress={submit} style={[st.navBtn, { backgroundColor: theme.green }]}>
            <Text style={[st.navTxt, { color: '#fff' }]}>Submit Quiz</Text>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  headT: { fontSize: 15, fontWeight: '900', color: theme.text, maxWidth: 200 },
  headS: { fontSize: 11, color: theme.textMuted, fontWeight: '700' },
  timer: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.saffron, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  timerTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  qNum: { fontSize: 11, color: theme.brand, fontWeight: '900', letterSpacing: 0.5 },
  qText: { fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 6, lineHeight: 26 },
  qType: { fontSize: 12, color: theme.textMuted, marginTop: 4, fontWeight: '700' },
  opt: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, marginTop: 10, borderRadius: 12, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.surface },
  optOn: { borderColor: theme.brand, backgroundColor: '#E6EAFA' },
  optTxt: { fontSize: 14, color: theme.text, flex: 1, fontWeight: '600' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },
  radioOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },
  checkOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  intBox: { borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, marginTop: 10, paddingHorizontal: 14 },
  intInp: { fontSize: 22, fontWeight: '900', color: theme.text, paddingVertical: 14, letterSpacing: 2 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', gap: 10 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.surface2 },
  navTxt: { color: theme.brand, fontWeight: '800' },
  resultIcon: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  resultTitle: { fontSize: 18, fontWeight: '900', color: theme.text, marginTop: 20, textAlign: 'center' },
  resultPct: { fontSize: 56, fontWeight: '900', color: theme.brand, marginTop: 10 },
  resultScore: { fontSize: 14, color: theme.textMuted, fontWeight: '700' },
  resultMsg: { fontSize: 14, color: theme.text, fontWeight: '700', marginTop: 14, textAlign: 'center' },
});
