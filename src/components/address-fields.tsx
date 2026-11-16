import { Text, View } from 'react-native';

import { Chip, Field } from '@/components/ui';
import { normalize } from '@/lib/format';
import type { ServiceArea } from '@/types';

/** Encontra o bairro atendido com o mesmo nome (sem diferenciar acento e maiúsculas). */
export function findArea(areas: ServiceArea[], neighborhood?: string): ServiceArea | undefined {
  const n = normalize(neighborhood ?? '').trim();
  return n ? areas.find((a) => normalize(a.name).trim() === n) : undefined;
}

/** Endereço + bairro para atendimento a domicílio (bairros atendidos viram atalhos). */
export function AddressFields({
  address,
  neighborhood,
  onChangeAddress,
  onChangeNeighborhood,
  areas,
  optional = false,
}: {
  address: string;
  neighborhood: string;
  onChangeAddress: (v: string) => void;
  onChangeNeighborhood: (v: string) => void;
  areas: ServiceArea[];
  optional?: boolean;
}) {
  const active = areas.filter((a) => a.isActive);
  const selected = findArea(active, neighborhood);
  return (
    <View>
      <Field
        label={`Endereço${optional ? ' (opcional)' : ''}`}
        value={address}
        onChangeText={onChangeAddress}
        placeholder="Rua, número, complemento / referência"
        autoCapitalize="words"
      />
      <Field
        label={`Bairro${optional ? ' (opcional)' : ''}`}
        value={neighborhood}
        onChangeText={onChangeNeighborhood}
        placeholder="Ex: Moema"
        autoCapitalize="words"
      />
      {active.length ? (
        <>
          <Text className="-mt-1 mb-1.5 text-[12px] text-muted">Bairros que você atende:</Text>
          <View className="flex-row flex-wrap">
            {active.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={selected?.id === a.id}
                onPress={() => onChangeNeighborhood(a.name)}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
