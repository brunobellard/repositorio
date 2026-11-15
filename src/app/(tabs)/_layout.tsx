import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName, active: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : name} color={color as string} size={size - 2} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Agenda', tabBarIcon: icon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="clientes"
        options={{ title: 'Clientes', tabBarIcon: icon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{ title: 'Financeiro', tabBarIcon: icon('wallet-outline', 'wallet') }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{ title: 'Ajustes', tabBarIcon: icon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
