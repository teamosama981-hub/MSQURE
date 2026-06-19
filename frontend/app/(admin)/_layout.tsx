import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/lib/theme';
import { View, ActivityIndicator } from 'react-native';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.brand} /></View>;
  if (!user) return <Redirect href="/landing" />;
  if (user.role === 'student') return <Redirect href="/(student)/home" />;
  const isSuper = user.role === 'super_admin';
  const isTeacher = user.role === 'teacher';
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.brand,
      tabBarInactiveTintColor: theme.textSubtle,
      tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
      tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, height: 64, paddingTop: 6, paddingBottom: 8 },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} /> }} />
      <Tabs.Screen name="payments" options={{ title: 'Payments', href: isTeacher ? null : '/(admin)/payments', tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} /> }} />
      <Tabs.Screen name="certificates" options={{ title: 'Certificates', href: isTeacher ? null : '/(admin)/certificates', tabBarIcon: ({ color, size }) => <Ionicons name="ribbon" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: isSuper ? 'Settings' : 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
      <Tabs.Screen name="content/[courseId]" options={{ href: null }} />
      <Tabs.Screen name="users" options={{ href: null }} />
      <Tabs.Screen name="announcement" options={{ href: null }} />
    </Tabs>
  );
}
