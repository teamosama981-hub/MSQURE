import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LOGO_URL, FOUNDATION, theme } from '@/src/lib/theme';

interface Props { size?: number; showText?: boolean; tagline?: boolean; color?: string }

export const Logo: React.FC<Props> = ({ size = 56, showText = true, tagline = false, color = theme.brand }) => (
  <View style={styles.row} testID="brand-logo">
    <Image source={{ uri: LOGO_URL }} style={{ width: size, height: size }} contentFit="contain" />
    {showText && (
      <View style={{ marginLeft: 10 }}>
        <Text style={[styles.title, { color }]} numberOfLines={1}>HENAKASHA</Text>
        <Text style={styles.sub} numberOfLines={1}>Tech & Welfare Foundation</Text>
        {tagline && <Text style={styles.tag}>Educate • Empower • Elevate</Text>}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  sub: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  tag: { fontSize: 9, color: theme.saffron, fontWeight: '700', marginTop: 1 },
});

export default Logo;
