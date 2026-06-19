import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image as RNImage, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/lib/api';
import { theme, spacing, radius, LOGO_URL, FOUNDATION } from '@/src/lib/theme';
import { Button } from '@/src/components/ui';

interface Course { id: string; name: string; description: string; instructor_name: string; category: string; price: number; discount_price: number; thumbnail: string; }

const CATEGORIES_ROW = ['All','Tech','JEE','NEET','CBSE Class 9','CBSE Class 10','CBSE Class 11','CBSE Class 12'];

export default function Landing() {
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<Course[]>([]);
  const [cat, setCat] = useState('All');

  useEffect(() => {
    api.get('/courses', { params: cat === 'All' ? {} : { category: cat } })
      .then(r => setCourses(r.data)).catch(() => {});
  }, [cat]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      {/* Header */}
      <View style={styles.header} testID="landing-header">
        <View style={styles.headerInner}>
          <Image source={{ uri: LOGO_URL }} style={{ width: 44, height: 44 }} contentFit="contain" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.brandName}>HENAKASHA</Text>
            <Text style={styles.brandSub}>Tech & Welfare Foundation</Text>
          </View>
          <Pressable testID="header-login" onPress={() => router.push('/(auth)/login' as any)} style={styles.signinBtn}>
            <Text style={styles.signinTxt}>Sign in</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 + insets.bottom }}>
        {/* HERO */}
        <View style={styles.hero}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1637589308599-3478cc55510d?w=1400' }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={["rgba(10,17,40,0.15)","rgba(10,17,40,0.85)"]} style={StyleSheet.absoluteFillObject} />
          <View style={styles.heroContent}>
            <View style={styles.tagPill}><Text style={styles.tagPillTxt}>Educate • Empower • Elevate</Text></View>
            <Text style={styles.heroTitle}>Build your future with{"\n"}quality online learning</Text>
            <Text style={styles.heroSub}>Live classes, recorded lessons, expert teachers and verified certificates — all in one platform.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button title="Explore Courses" testID="hero-explore-btn" onPress={() => router.push('/(auth)/register' as any)} />
              <Button title="Sign In" variant="outline" testID="hero-signin-btn" onPress={() => router.push('/(auth)/login' as any)} />
            </View>
          </View>
        </View>

        {/* CATEGORY ROW */}
        <View style={{ marginTop: spacing.xl }}>
          <Text style={styles.sectionTitle}>Browse by category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 6, gap: 8 }}>
            {CATEGORIES_ROW.map((c) => (
              <Pressable key={c} testID={`cat-${c}`} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
                <Text style={[styles.chipTxt, cat === c && styles.chipTxtActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* FEATURED */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Featured courses</Text>
            <Pressable testID="see-all-courses" onPress={() => router.push('/(auth)/register' as any)}>
              <Text style={styles.link}>See all →</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {courses.slice(0, 6).map(c => (
              <Pressable key={c.id} testID={`course-card-${c.id}`} onPress={() => router.push('/(auth)/login' as any)} style={styles.card}>
                <Image source={{ uri: c.thumbnail }} style={styles.thumb} contentFit="cover" />
                <View style={{ padding: 10 }}>
                  <Text style={styles.catPill}>{c.category}</Text>
                  <Text style={styles.cardTitle} numberOfLines={2}>{c.name}</Text>
                  <Text style={styles.cardInstructor}>by {c.instructor_name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                    <Text style={styles.price}>₹{c.discount_price || c.price}</Text>
                    {!!c.discount_price && c.price !== c.discount_price && <Text style={styles.priceCut}>₹{c.price}</Text>}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ABOUT */}
        <View style={styles.aboutCard}>
          <Text style={styles.aboutH}>About the Foundation</Text>
          <Text style={styles.aboutP}>HENAKASHA TECH & WELFARE FOUNDATION is committed to making quality education accessible to every learner. Our mission is to Educate, Empower and Elevate through technology-led learning.</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <Stat n="10K+" l="Students" />
            <Stat n="50+" l="Live Courses" />
            <Stat n="120+" l="Expert Teachers" />
            <Stat n="98%" l="Satisfaction" />
          </View>
        </View>

        <View style={styles.footer}>
          <Image source={{ uri: LOGO_URL }} style={{ width: 60, height: 60 }} contentFit="contain" />
          <Text style={styles.footerName}>{FOUNDATION}</Text>
          <Text style={styles.footerTag}>© 2026 All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat = ({ n, l }: { n: string; l: string }) => (
  <View style={statSt.box}>
    <Text style={statSt.n}>{n}</Text>
    <Text style={statSt.l}>{l}</Text>
  </View>
);
const statSt = StyleSheet.create({
  box: { backgroundColor: theme.surface2, padding: 12, borderRadius: 12, minWidth: 110, alignItems: 'center' },
  n: { fontSize: 20, fontWeight: '800', color: theme.brand },
  l: { fontSize: 12, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
});

const styles = StyleSheet.create({
  header: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border, paddingVertical: 8 },
  headerInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg },
  brandName: { fontSize: 16, fontWeight: '900', color: theme.brand, letterSpacing: 0.4 },
  brandSub: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  signinBtn: { backgroundColor: theme.brand, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  signinTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hero: { height: 360, marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end' },
  heroContent: { padding: 20 },
  tagPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,138,30,0.95)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagPillTxt: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.4 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 10, lineHeight: 34 },
  heroSub: { color: '#E6EAFA', fontSize: 14, marginTop: 6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.text, paddingHorizontal: spacing.lg, marginTop: 6 },
  link: { color: theme.brand, fontWeight: '700' },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, flexShrink: 0 },
  chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
  chipTxt: { color: theme.text, fontWeight: '700', fontSize: 13 },
  chipTxtActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 12, marginTop: 8 },
  card: { width: (Dimensions.get('window').width - spacing.lg * 2 - 12) / 2, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  thumb: { width: '100%', height: 110, backgroundColor: theme.surface2 },
  catPill: { fontSize: 10, color: theme.saffron, fontWeight: '800', letterSpacing: 0.4 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: theme.text, marginTop: 4 },
  cardInstructor: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '900', color: theme.green },
  priceCut: { fontSize: 11, color: theme.textSubtle, textDecorationLine: 'line-through' },
  aboutCard: { margin: spacing.lg, backgroundColor: theme.surface2, padding: spacing.lg, borderRadius: 20 },
  aboutH: { fontSize: 18, fontWeight: '800', color: theme.brand },
  aboutP: { fontSize: 13, color: theme.textMuted, marginTop: 6, lineHeight: 20 },
  footer: { alignItems: 'center', paddingVertical: spacing.xl, gap: 6 },
  footerName: { fontSize: 14, fontWeight: '800', color: theme.brand },
  footerTag: { fontSize: 11, color: theme.textSubtle },
});
