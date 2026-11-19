import { useHeaderHeight } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView } from 'react-native';

/**
 * Sobe o conteúdo quando o teclado abre, no iPhone e no Android.
 * No Android (Expo é edge-to-edge) a janela não encolhe sozinha: sem `behavior` o campo fica embaixo do teclado.
 * Telas sem cabeçalho (login, primeiro acesso).
 */
export function KeyboardView({ children, className = 'flex-1 bg-bg' }: { children: ReactNode; className?: string }) {
  return (
    <KeyboardAvoidingView behavior="padding" className={className}>
      {children}
    </KeyboardAvoidingView>
  );
}

/** Igual ao KeyboardView, para telas com cabeçalho: desconta a altura do cabeçalho. */
export function HeaderKeyboardView({ children, className = 'flex-1 bg-bg' }: { children: ReactNode; className?: string }) {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} className={className}>
      {children}
    </KeyboardAvoidingView>
  );
}
