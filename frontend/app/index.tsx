import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, routeForRole } from '@/src/lib/auth';
import { theme } from '@/src/lib/theme';

export default function Index() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (user) router.replace(routeForRole(user.role) as any);
    else router.replace('/landing' as any);
  }, [user, loading]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface }}>
      <ActivityIndicator size="large" color={theme.brand} />
    </View>
  );
}
