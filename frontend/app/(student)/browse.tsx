import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, FlatList, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing } from '@/src/lib/theme';

const W = Dimensions.get('window').width;

export default function Browse() {
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<string[]>(['All']);
  const [cat, setCat] = useState('All');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    api.get('/categories').then(r => setCats(['All', ...r.data.map((c: any) => c.name)])).catch(() => {});
  }, []);
  useEffect(() => {
    const params: any = {};
    if (q) params.q = q;
    if (cat !== 'All') params.category = cat;
    api.get('/courses', { params }).then(r => setItems(r.data)).catch(() => {});
  }, [q, cat]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <View style={st.head}>
        <Text style={st.title}>Browse courses</Text>
        <View style={st.searchBox}>
          <Ionicons name="search" size={18} color={theme.textSubtle} />
          <TextInput
            testID="browse-search"
            value={q} onChangeText={setQ}
            placeholder="Search courses, topics, teachers..."
            placeholderTextColor={theme.textSubtle}
            style={st.searchInp}
          />
        </View>
      </View>
      <View style={{ height: 56 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 8, gap: 8 }}>
          {cats.map(c => (
            <Pressable key={c} testID={`browse-cat-${c}`} onPress={() => setCat(c)} style={[st.chip, cat === c && st.chipOn]}>
              <Text style={[st.chipTxt, cat === c && st.chipTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, paddingTop: 8 }}
        columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
        ListEmptyComponent={
          <View style={st.empty}>
            <Ionicons name="school-outline" size={48} color={theme.textSubtle} />
            <Text style={st.emptyT}>No courses found</Text>
            <Text style={st.emptyS}>Try a different search or category</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable testID={`browse-course-${item.id}`} onPress={() => router.push(`/course/${item.id}` as any)} style={st.card}>
            <Image source={{ uri: item.thumbnail }} style={st.thumb} contentFit="cover" />
            <View style={{ padding: 10 }}>
              <Text style={st.pill}>{item.category}</Text>
              <Text style={st.cT} numberOfLines={2}>{item.name}</Text>
              <Text style={st.cI}>by {item.instructor_name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <Text style={st.price}>₹{item.discount_price || item.price}</Text>
                {!!item.discount_price && item.price !== item.discount_price && <Text style={st.priceCut}>₹{item.price}</Text>}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const cardW = (W - spacing.lg * 2 - 12) / 2;
const st = StyleSheet.create({
  head: { paddingHorizontal: spacing.lg, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: theme.text, marginVertical: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInp: { flex: 1, fontSize: 14, color: theme.text },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, flexShrink: 0 },
  chipOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  chipTxt: { fontSize: 13, color: theme.text, fontWeight: '700' },
  chipTxtOn: { color: '#fff' },
  card: { width: cardW, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  thumb: { width: '100%', height: 110, backgroundColor: theme.surface2 },
  pill: { fontSize: 10, color: theme.saffron, fontWeight: '800' },
  cT: { fontSize: 13, fontWeight: '800', color: theme.text, marginTop: 2 },
  cI: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '900', color: theme.green },
  priceCut: { fontSize: 11, color: theme.textSubtle, textDecorationLine: 'line-through' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyT: { fontSize: 16, fontWeight: '800', color: theme.text },
  emptyS: { fontSize: 13, color: theme.textMuted },
});
