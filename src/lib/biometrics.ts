import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'biometric_login_enabled';

export interface BiometricSupport {
  available: boolean;
  /** "digital" ou "Face ID", para os textos da interface */
  label: string;
  icon: 'finger-print' | 'scan-outline';
}

const NONE: BiometricSupport = { available: false, label: 'digital', icon: 'finger-print' };

/** O aparelho tem leitor biométrico com digital/rosto cadastrado? */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') return NONE;
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face =
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) &&
      !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    return {
      available: hardware && enrolled,
      label: face ? (Platform.OS === 'ios' ? 'Face ID' : 'reconhecimento facial') : 'digital',
      icon: face ? 'scan-outline' : 'finger-print',
    };
  } catch {
    return NONE;
  }
}

export async function authenticate(promptMessage = 'Desbloquear Agenda Beleza'): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar código do aparelho',
  });
  return result.success;
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  if (on) await SecureStore.setItemAsync(KEY, '1');
  else await SecureStore.deleteItemAsync(KEY);
}
