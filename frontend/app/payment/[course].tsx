import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/lib/api';
import { theme, spacing, QR_URL } from '@/src/lib/theme';
import { Button } from '@/src/components/ui';
import { Platform } from "react-native";
import RazorpayCheckout from "react-native-razorpay";

export default function Payment() {
  const { course } = useLocalSearchParams<{ course: string }>();
  const [c, setC] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [method, setMethod] = useState<'manual' | 'razorpay'>('manual');
  const [utr, setUtr] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!course) return;
    api.get(`/courses/${course}`).then(r => setC(r.data));
    api.get('/settings').then(r => setSettings(r.data));
  }, [course]);
const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (Platform.OS !== "web") {
      resolve(true);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
  
  const submitManual = async () => {
    setMsg(null);
    if (!utr.trim()) { setMsg({ kind: 'err', text: 'Please enter your UTR / transaction reference' }); return; }
    setLoading(true);
    try {
      await api.post('/payments/manual', {
        course_id: course, utr: utr.trim(),
        amount: c.discount_price || c.price,
      });
      setMsg({ kind: 'ok', text: 'Payment submitted! Admin will verify shortly. You will be enrolled automatically on approval.' });
      setTimeout(() => router.replace('/(student)/my-study?tab=payments' as any), 1800);
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.detail || 'Failed to submit' });
    } finally { setLoading(false); }
  };

  const submitRazorpay = async () => {
    setMsg(null); setLoading(true);
    try {
      const r = await api.post(
  "/payments/razorpay/order",
  null,
  {
    params: {
      course_id: course,
    },
  }
);

const order = r.data;

      if (Platform.OS === "web") {
  const ok = await loadRazorpay();

  if (!ok) {
    throw new Error("Failed to load Razorpay SDK");
  }

  const rz = new (window as any).Razorpay({
    key: order.key_id,
    amount: order.amount,
    currency: order.currency,
    order_id: order.order_id,

    name: "MSQURE TECH & WELFARE FOUNDATION",
    description: c.name,

    handler: async (response: any) => {
      await api.post(
        "/payments/razorpay/verify",
        {
          course_id: course,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }
      );

      setMsg({
        kind: "ok",
        text: "Payment successful! Enrolled.",
      });

      setTimeout(() => {
        router.replace(`/course/${course}` as any);
      }, 1500);
    },

    prefill: {
      name: "",
      email: "",
      contact: "",
    },

    theme: {
      color: "#1E40AF",
    },
  });

  rz.open();
  return;
}

const payment = await RazorpayCheckout.open({
  key: order.key_id,
  amount: order.amount,
  currency: order.currency,
  order_id: order.order_id,

  name: "M SQURE TECH & WELFARE FOUNDATION",
  description: c.name,

  prefill: {
    name: "",
    email: "",
    contact: "",
  },

  theme: {
    color: "#1E40AF",
  },
});

await api.post("/payments/razorpay/verify", {
  course_id: course,
  razorpay_order_id: payment.razorpay_order_id,
  razorpay_payment_id: payment.razorpay_payment_id,
  razorpay_signature: payment.razorpay_signature,
});

setMsg({
  kind: "ok",
  text: "Payment successful! Enrolled.",
});

setTimeout(() => {
  router.replace(`/course/${course}` as any);
}, 1500);
      
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.detail || 'Razorpay is not configured. Please use Manual UPI.' });
    } finally { setLoading(false); }
  };

  if (!c) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.brand} /></View>;
  const amount = c.discount_price || c.price;
  const qrUri = settings?.upi_qr_url || QR_URL;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
        <Text style={st.headT}>Checkout</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {/* Order summary */}
        <View style={st.card}>
          <Text style={st.lbl}>ORDER SUMMARY</Text>
          <Text style={st.cName}>{c.name}</Text>
          <Text style={st.cInstr}>by {c.instructor_name}</Text>
          <View style={st.divider} />
          <View style={st.rowEnd}><Text style={st.k}>Price</Text><Text style={st.v}>₹{c.price}</Text></View>
          {!!c.discount_price && c.price !== c.discount_price && (
            <View style={st.rowEnd}><Text style={st.k}>Discount</Text><Text style={[st.v, { color: theme.green }]}>-₹{c.price - c.discount_price}</Text></View>
          )}
          <View style={st.divider} />
          <View style={st.rowEnd}><Text style={[st.k, { color: theme.text, fontWeight: '900', fontSize: 15 }]}>Total</Text><Text style={[st.v, { fontSize: 18, color: theme.green }]}>₹{amount}</Text></View>
        </View>

        {/* Method selector */}
        <Text style={st.section}>Payment method</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable testID="pay-method-manual" onPress={() => setMethod('manual')} style={[st.methodBox, method === 'manual' && st.methodOn]}>
            <Ionicons name="qr-code" size={20} color={method === 'manual' ? theme.brand : theme.textSubtle} />
            <Text style={[st.methodTxt, method === 'manual' && { color: theme.brand }]}>Manual UPI</Text>
          </Pressable>
          {settings?.razorpay_enabled && (
            <Pressable testID="pay-method-rzp" onPress={() => setMethod('razorpay')} style={[st.methodBox, method === 'razorpay' && st.methodOn]}>
              <Ionicons name="card" size={20} color={method === 'razorpay' ? theme.brand : theme.textSubtle} />
              <Text style={[st.methodTxt, method === 'razorpay' && { color: theme.brand }]}>Razorpay</Text>
            </Pressable>
          )}
        </View>

        {method === 'manual' && (
          <>
            <View style={st.card}>
              <Text style={st.lbl}>SCAN & PAY</Text>
              <Image source={{ uri: qrUri }} style={st.qr} contentFit="contain" />
              <Text style={st.upiId}>UPI ID: {settings?.upi_id || '—'}</Text>
              <View style={st.note}>
                <Ionicons name="information-circle" size={16} color={theme.brand} />
                <Text style={st.noteTxt}>After payment, enter your UTR / Transaction ID below. Admin will approve & auto-enroll you.</Text>
              </View>
            </View>
            <Text style={st.section}>UTR / Transaction Reference</Text>
            <View style={st.utrBox}>
              <TextInput testID="pay-utr-input" value={utr} onChangeText={setUtr} placeholder="Enter 12-digit UTR" placeholderTextColor={theme.textSubtle} style={st.utrInp} autoCapitalize="characters" />
            </View>
            {msg && <Text style={[st.msg, msg.kind === 'ok' ? st.msgOk : st.msgErr]}>{msg.text}</Text>}
            <Button title={`Submit Payment (₹${amount})`} testID="pay-submit-manual" onPress={submitManual} loading={loading} full />
          </>
        )}

        {method === 'razorpay' && (
          <>
            <View style={st.card}>
              <Text style={st.lbl}>RAZORPAY CHECKOUT</Text>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>You will be redirected to Razorpay to complete payment. On success, your course is unlocked instantly.</Text>
            </View>
            {msg && <Text style={[st.msg, msg.kind === 'ok' ? st.msgOk : st.msgErr]}>{msg.text}</Text>}
            <Button title={`Pay ₹${amount} via Razorpay`} testID="pay-submit-rzp" onPress={submitRazorpay} loading={loading} full />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, justifyContent: 'space-between' },
  headT: { fontSize: 16, fontWeight: '900', color: theme.text },
  card: { backgroundColor: theme.surface2, borderRadius: 16, padding: spacing.lg, marginTop: spacing.md },
  lbl: { fontSize: 11, color: theme.textMuted, fontWeight: '900', letterSpacing: 0.6, marginBottom: 6 },
  cName: { fontSize: 16, fontWeight: '800', color: theme.text },
  cInstr: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 10 },
  rowEnd: { flexDirection: 'row', justifyContent: 'space-between' },
  k: { color: theme.textMuted, fontSize: 13, fontWeight: '700' },
  v: { color: theme.text, fontSize: 13, fontWeight: '800' },
  section: { fontSize: 14, fontWeight: '800', color: theme.text, marginTop: spacing.lg, marginBottom: 8 },
  methodBox: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.surface, alignItems: 'center', gap: 6 },
  methodOn: { borderColor: theme.brand, backgroundColor: '#E6EAFA' },
  methodTxt: { fontSize: 13, color: theme.text, fontWeight: '800' },
  qr: { width: 220, height: 220, alignSelf: 'center', backgroundColor: '#000', borderRadius: 12 },
  upiId: { textAlign: 'center', color: theme.text, fontWeight: '800', marginTop: 10, fontSize: 13 },
  note: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 10, backgroundColor: '#E6EAFA', borderRadius: 10 },
  noteTxt: { fontSize: 11, color: theme.brand, flex: 1, fontWeight: '600' },
  utrBox: { borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: theme.surface },
  utrInp: { fontSize: 16, color: theme.text, paddingVertical: 10, letterSpacing: 1.5, fontWeight: '700' },
  msg: { padding: 10, borderRadius: 10, marginBottom: 10, fontSize: 13, fontWeight: '700' },
  msgOk: { backgroundColor: '#E8FBEE', color: theme.greenDeep },
  msgErr: { backgroundColor: '#FCEBED', color: theme.error },
});
