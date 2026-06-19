import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { theme, radius, spacing } from '@/src/lib/theme';

export const Button: React.FC<{
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  loading?: boolean; disabled?: boolean; testID?: string; full?: boolean; small?: boolean;
}> = ({ title, onPress, variant = 'primary', loading, disabled, testID, full, small }) => {
  const bg = variant === 'primary' ? theme.brand : variant === 'secondary' ? theme.saffron : 'transparent';
  const color = variant === 'outline' || variant === 'ghost' ? theme.brand : '#fff';
  const border = variant === 'outline' ? theme.brand : 'transparent';
  return (
    <Pressable testID={testID} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'outline' ? 1.5 : 0 },
        full && { alignSelf: 'stretch' },
        small && { paddingVertical: 8, paddingHorizontal: 14 },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
      ]}>
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.text, { color }, small && { fontSize: 14 }]}>{title}</Text>}
    </Pressable>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: any; testID?: string }> = ({ children, style, testID }) => (
  <View testID={testID} style={[styles.card, style]}>{children}</View>
);

export const Input: React.FC<any> = ({ label, error, testID, ...props }) => (
  <View style={{ marginBottom: spacing.md }}>
    {label && <Text style={styles.label}>{label}</Text>}
    <View style={[styles.inputBox, error && { borderColor: theme.error }]}>
      <Text style={{ display: 'none' }} />
      {React.createElement(require('react-native').TextInput, {
        testID, ...props, style: styles.input, placeholderTextColor: theme.textSubtle,
      })}
    </View>
    {error ? <Text style={styles.err}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: theme.border, shadowColor: theme.shadow, shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  label: { fontSize: 13, fontWeight: '700', color: theme.textMuted, marginBottom: 6 },
  inputBox: { borderWidth: 1.5, borderColor: theme.border, borderRadius: radius.md, backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 10 },
  input: { fontSize: 15, color: theme.text, paddingVertical: 6 },
  err: { color: theme.error, fontSize: 12, marginTop: 4 },
});

export default { Button, Card, Input };
