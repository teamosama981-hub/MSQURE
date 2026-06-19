import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/src/components/ui';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/lib/auth';
import { theme, spacing, LOGO_URL, FOUNDATION } from '@/src/lib/theme';

export default function Settings() {
  const { user, logout } = useAuth();
  const isSuper = user?.role === 'super_admin';
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { api.get('/settings').then(r => setS(r.data)); }, []);

  if (!s) return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading...</Text></SafeAreaView>;

  const save = async () => {
    setMsg('');
    try {
      await api.put('/settings', {
        upi_id: s.upi_id, upi_qr_url: s.upi_qr_url,
        manual_payment_enabled: s.manual_payment_enabled,
        razorpay_key_id: s.razorpay_key_id, razorpay_key_secret: s.razorpay_key_secret,
        razorpay_enabled: s.razorpay_enabled, teams_default_link: s.teams_default_link,
        contact_email: s.contact_email, contact_phone: s.contact_phone, whatsapp_number: s.whatsapp_number,
      });
      setMsg('Saved successfully.');
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Save failed'); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <View style={st.brandBox}>
          <Image source={{ uri: LOGO_URL }} style={{ width: 80, height: 80 }} contentFit="contain" />
          <Text style={st.foundation}>{FOUNDATION}</Text>
          <Text style={st.user}>{user?.full_name} • {user?.role?.replace('_', ' ').toUpperCase()}</Text>
        </View>

        {isSuper && (
          <>
            <Text style={st.section}>Manual UPI Payment</Text>
            <View style={st.card}>
              <Input testID="set-upi-id" label="UPI ID" value={s.upi_id} onChangeText={(v: string) => setS({ ...s, upi_id: v })} />
              <Input testID="set-qr-url" label="UPI QR Image URL" value={s.upi_qr_url} onChangeText={(v: string) => setS({ ...s, upi_qr_url: v })} />
              {!!s.upi_qr_url && <Image source={{ uri: s.upi_qr_url }} style={st.qrPreview} contentFit="contain" />}
              <ToggleRow t="Enable Manual UPI" v={s.manual_payment_enabled} onChange={(v: boolean) => setS({ ...s, manual_payment_enabled: v })} />
            </View>

            <Text style={st.section}>Razorpay (Automatic)</Text>
            <View style={st.card}>
              <Input testID="set-rzp-key" label="Razorpay Key ID" value={s.razorpay_key_id} onChangeText={(v: string) => setS({ ...s, razorpay_key_id: v })} placeholder="rzp_test_..." />
              <Input testID="set-rzp-secret" label="Razorpay Key Secret" value={s.razorpay_key_secret} onChangeText={(v: string) => setS({ ...s, razorpay_key_secret: v })} secureTextEntry />
              <ToggleRow t="Enable Razorpay" v={s.razorpay_enabled} onChange={(v: boolean) => setS({ ...s, razorpay_enabled: v })} />
            </View>

            <Text style={st.section}>Contact & Support</Text>
            <View style={st.card}>
              <Input testID="set-email" label="Contact Email" value={s.contact_email} onChangeText={(v: string) => setS({ ...s, contact_email: v })} />
              <Input testID="set-phone" label="Contact Phone" value={s.contact_phone} onChangeText={(v: string) => setS({ ...s, contact_phone: v })} />
              <Input testID="set-wa" label="WhatsApp Support Number" value={s.whatsapp_number} onChangeText={(v: string) => setS({ ...s, whatsapp_number: v })} placeholder="+91..." />
              <Input testID="set-teams" label="Default MS Teams Link" value={s.teams_default_link} onChangeText={(v: string) => setS({ ...s, teams_default_link: v })} />
            </View>

            {!!msg && <Text style={{ color: theme.green, fontWeight: '800', marginVertical: 8 }}>{msg}</Text>}
            <Button title="Save Settings" testID="set-save" onPress={save} full />
          </>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <Button title="Sign Out" variant="outline" testID="set-logout" onPress={logout} full />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const ToggleRow = ({ t, v, onChange }: any) => (
  <View style={st.tRow}><Text style={{ flex: 1, fontWeight: '700', color: theme.text }}>{t}</Text><Switch value={v} onValueChange={onChange} trackColor={{ true: theme.green, false: theme.border }} /></View>
);
const st = StyleSheet.create({
  brandBox: { alignItems: 'center', padding: 16, gap: 4 },
  foundation: { fontSize: 13, fontWeight: '900', color: theme.brand, marginTop: 6 },
  user: { fontSize: 12, color: theme.textMuted, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '900', color: theme.textMuted, letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: 8 },
  card: { backgroundColor: theme.surface, padding: spacing.lg, borderRadius: 16, borderWidth: 1, borderColor: theme.border },
  qrPreview: { width: 160, height: 160, alignSelf: 'center', backgroundColor: '#000', borderRadius: 12, marginVertical: 10 },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
