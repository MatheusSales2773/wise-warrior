import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isApiError } from '@/core/api/api-error';
import type { UserProfile } from '@/features/dashboard/api';
import { dashboardKeys } from '@/features/dashboard/queries';
import { equipCosmeticItem, unequipCosmeticItem, type CatalogCosmeticItem } from './api';
import { catalogWithEquipped, catalogWithoutEquipped, profileWithEquipped, profileWithoutEquipped } from './equipment';
import { profileKeys } from './queries';

export type CosmeticEquipment = ReturnType<typeof useCosmeticEquipment>;

export type EquipmentNotice = { title: string; message: string };

type Change = { item: CatalogCosmeticItem; action: 'equip' | 'unequip' };
type Snapshot = { catalog: CatalogCosmeticItem[] | undefined; profile: UserProfile | undefined };

function failureNotice({ item, action }: Change, error: unknown): EquipmentNotice {
  if (action === 'equip' && isApiError(error) && error.status === 403) {
    return {
      title: 'Item exclusivo do plano premium',
      message: `${item.name} é exclusivo do plano premium e não pôde ser equipado. Seu personagem voltou ao que era antes.`,
    };
  }
  return {
    title: action === 'equip' ? 'Nada foi equipado' : 'Nada foi desequipado',
    message: `Não foi possível ${action === 'equip' ? 'equipar' : 'desequipar'} ${item.name}. Seu personagem voltou ao que era antes. Tente novamente em instantes.`,
  };
}

/**
 * Prévia, Equipar e desequipar. A Prévia (`selectedId`) só vive no cliente; Equipar e desequipar
 * mudam o Catálogo e o perfil na hora, voltam atrás se o servidor recusar e ao fim recarregam os dois.
 */
export function useCosmeticEquipment() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<EquipmentNotice | null>(null);

  const mutation = useMutation({
    mutationFn: ({ item, action }: Change) => (action === 'equip' ? equipCosmeticItem(item.id) : unequipCosmeticItem(item.id)),
    onMutate: async ({ item, action }): Promise<Snapshot> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: profileKeys.cosmeticsCatalog() }),
        queryClient.cancelQueries({ queryKey: dashboardKeys.profile() }),
      ]);
      const snapshot: Snapshot = {
        catalog: queryClient.getQueryData<CatalogCosmeticItem[]>(profileKeys.cosmeticsCatalog()),
        profile: queryClient.getQueryData<UserProfile>(dashboardKeys.profile()),
      };
      queryClient.setQueryData<CatalogCosmeticItem[]>(
        profileKeys.cosmeticsCatalog(),
        (catalog) => catalog && (action === 'equip' ? catalogWithEquipped(catalog, item) : catalogWithoutEquipped(catalog, item)),
      );
      queryClient.setQueryData<UserProfile>(
        dashboardKeys.profile(),
        (profile) => profile && (action === 'equip' ? profileWithEquipped(profile, item) : profileWithoutEquipped(profile, item)),
      );
      setNotice(null);
      setSelectedId(null);
      return snapshot;
    },
    onError: (error, change, snapshot) => {
      queryClient.setQueryData(profileKeys.cosmeticsCatalog(), snapshot?.catalog);
      queryClient.setQueryData(dashboardKeys.profile(), snapshot?.profile);
      setNotice(failureNotice(change, error));
    },
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: profileKeys.cosmeticsCatalog() }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.profile() }),
    ]),
  });

  return {
    selectedId,
    notice,
    busy: mutation.isPending,
    /** Só itens desbloqueados têm Prévia, um por vez. */
    preview: (item: CatalogCosmeticItem) => {
      if (item.unlocked && !mutation.isPending) setSelectedId(item.id);
    },
    cancel: () => setSelectedId(null),
    equip: (item: CatalogCosmeticItem) => mutation.mutate({ item, action: 'equip' }),
    unequip: (item: CatalogCosmeticItem) => mutation.mutate({ item, action: 'unequip' }),
  };
}
