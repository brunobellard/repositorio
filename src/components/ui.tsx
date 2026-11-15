import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initials } from '@/lib/format';
import { colors, statusInfo } from '@/theme/colors';
import type { AppointmentStatus } from '@/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Container das abas: fundo off-white + espaço do topo (notch). */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
}

export function ScreenTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-end justify-between px-5 pb-3 pt-2">
      <View className="flex-1">
        {subtitle ? <Text className="text-sm text-muted">{subtitle}</Text> : null}
        <Text className="text-[28px] font-bold tracking-tight text-ink">{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-card border border-line bg-surface p-4 ${className}`}>{children}</View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </Text>
  );
}

export function StatusPill({ status, size = 'sm' }: { status: AppointmentStatus; size?: 'sm' | 'md' }) {
  const s = statusInfo[status];
  return (
    <View className={`flex-row items-center self-start rounded-full ${s.bgClass} ${size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1'}`}>
      <View className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      <Text className={`font-semibold ${s.text} ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}>
        {s.label}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  sublabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  sublabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-4 py-2 ${
        selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
      }`}>
      <Text className={`text-sm font-medium ${selected ? 'text-primary-dark' : 'text-ink'}`}>{label}</Text>
      {sublabel ? <Text className="text-[11px] text-muted">{sublabel}</Text> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-full bg-line/70 p-1">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          className={`flex-1 items-center rounded-full px-3 py-1.5 ${value === o.value ? 'bg-surface' : ''}`}>
          <Text className={`text-[13px] font-semibold ${value === o.value ? 'text-ink' : 'text-muted'}`}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'whatsapp' | 'danger';
  icon?: IconName;
  disabled?: boolean;
}) {
  const styles = {
    primary: { box: 'bg-primary', text: 'text-white', icon: '#fff' },
    secondary: { box: 'border border-line bg-surface', text: 'text-ink', icon: colors.ink },
    whatsapp: { box: 'bg-[#25A366]', text: 'text-white', icon: '#fff' },
    danger: { box: 'border border-line bg-surface', text: 'text-[#B2474F]', icon: '#B2474F' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center rounded-2xl px-4 py-3.5 active:opacity-80 ${styles.box} ${disabled ? 'opacity-40' : ''}`}>
      {icon ? <Ionicons name={icon} size={18} color={styles.icon} style={{ marginRight: 8 }} /> : null}
      <Text className={`text-[15px] font-semibold ${styles.text}`}>{title}</Text>
    </Pressable>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View
      className="items-center justify-center rounded-full bg-primary-soft"
      style={{ width: size, height: size }}>
      <Text className="font-semibold text-primary-dark" style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-[13px] font-medium text-muted">{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        className="rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
        {...props}
      />
    </View>
  );
}

export function SearchBar(props: TextInputProps) {
  return (
    <View className="mx-5 mb-3 flex-row items-center rounded-2xl border border-line bg-surface px-3">
      <Ionicons name="search" size={18} color={colors.muted} />
      <TextInput
        placeholderTextColor={colors.muted}
        className="flex-1 px-2 py-3 text-[15px] text-ink"
        {...props}
      />
    </View>
  );
}

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary active:opacity-80"
      style={{
        shadowColor: colors.primaryDark,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}>
      <Ionicons name={icon} size={28} color="#fff" />
    </Pressable>
  );
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="items-center py-10">
      <Ionicons name={icon} size={32} color={colors.line} />
      <Text className="mt-2 text-sm text-muted">{text}</Text>
    </View>
  );
}

/** Interruptor liga/desliga nas cores do app (no navegador também). */
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  // activeThumbColor/activeTrackColor são do react-native-web; no celular são ignorados
  const webColors = { activeThumbColor: '#fff', activeTrackColor: colors.primary } as object;
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.primary, false: colors.line }}
      thumbColor="#fff"
      ios_backgroundColor={colors.line}
      {...webColors}
    />
  );
}
