import { Image } from 'expo-image';

const logo = require('@/assets/images/logo.png');

/** Logo do Esmero (o mesmo desenho do ícone do app), com cantos arredondados. */
export function AppLogo({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={logo}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      contentFit="cover"
      accessibilityLabel="Logo do Esmero"
    />
  );
}
