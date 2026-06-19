import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/src/lib/auth';
import { theme, spacing, LOGO_URL, FOUNDATION } from '@/src/lib/theme';
import { Button } from '@/src/components/ui';

export default function Profile() {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={st.head}>
          <Image source={{ uri: LOGO_URL }} style={{ width: 70, height: 70 }} contentFit="contain" />
          <Text style={st.name} testID="profile-name">{user?.full_name}</Text>
          <Text style={st.user}>@{user?.username}</Text>
          <View style={st.rolePill}><Text style={st.roleTxt}>{user?.role?.replace('_', ' ').toUpperCase()}</Text></View>
        </View>

        <View style={st.card}>
          <Row icon="mail" k="Email" v={user?.email || '-'} />
          <Row icon="call" k="Phone" v={user?.phone || '-'} />
        </View>

        <Text style={st.section}>Quick Actions</Text>
        <View style={st.card}>
          <ActionRow icon="notifications" t="Notifications" onPress={() => router.push('/notifications' as any)} testID="profile-notifications" />
          <ActionRow icon="logo-whatsapp" t="WhatsApp Support" onPress={() => Linking.openURL('https://wa.me/919000000000')} testID="profile-whatsapp" />
          <ActionRow icon="help-circle" t="FAQ & Contact" onPress={() => Linking.openURL('mailto:support@henakasha.org')} testID="profile-help" />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Button title="Sign Out" testID="profile-logout" variant="outline" onPress={logout} full />
        </View>

        <View style={st.footer}>
          <Text style={st.foundation}>{FOUNDATION}</Text>
          <Text style={st.tag}>Educate • Empower • Elevate</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ icon, k, v }: any) => (
  <View style={st.row}>
    <Ionicons name={icon} size={18} color={theme.brand} />
    <Text style={st.rowK}>{k}</Text>
    <Text style={st.rowV}>{v}</Text>
  </View>
);

const ActionRow = ({ icon, t, onPress, testID }: any) => (
  <Pressable testID={testID} onPress={onPress} style={st.aRow}>
    <Ionicons name={icon} size={20} color={theme.brand} />
    <Text style={st.aTxt}>{t}</Text>
    <Ionicons name="chevron-forward" size={18} color={theme.textSubtle} />
  </Pressable>
);

const st = StyleSheet.create({
  head: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  name: { fontSize: 20, fontWeight: '900', color: theme.text, marginTop: 8 },
  user: { fontSize: 13, color: theme.textMuted },
  rolePill: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: theme.brand, borderRadius: 999, marginTop: 4 },
  roleTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  card: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, marginTop: spacing.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  rowK: { color: theme.textMuted, fontSize: 13, fontWeight: '700', minWidth: 60 },
  rowV: { color: theme.text, fontSize: 13, fontWeight: '600', flex: 1 },
  aRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  aTxt: { flex: 1, color: theme.text, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '800', color: theme.textMuted, marginTop: spacing.lg, marginBottom: 4, letterSpacing: 0.5 },
  footer: { alignItems: 'center', marginTop: spacing.xxl },
  foundation: { fontSize: 12, fontWeight: '800', color: theme.brand },
  tag: { fontSize: 10, color: theme.saffron, marginTop: 2, fontWeight: '700' },
});
