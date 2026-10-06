import { collection, doc, getFirestore, updateDoc } from '@core/firebase/firestore';
import { getApp, isFirebaseReady } from '@core/firebase';
import { readDoc } from '@core/firebase/db';
import { createStorage } from '@core/storage';
import type { OptionGroup } from '@modules/food/types';

export type CustomizationTemplate = { id: string; group: OptionGroup };
const storage = createStorage({ id: 'azglobe-customization-templates' });

export async function listCustomizationTemplates(merchantId: string): Promise<CustomizationTemplate[]> {
  if (!isFirebaseReady()) return JSON.parse(storage.getString(merchantId) ?? '[]');
  const merchant = await readDoc<{ customizationTemplates?: Record<string, OptionGroup> }>('merchants', merchantId);
  return Object.entries(merchant?.customizationTemplates ?? {}).map(([id, group]) => ({ id, group }));
}

/** Template updates affect future copies only; live dishes keep their own options. */
export async function saveCustomizationTemplate(merchantId: string, template: CustomizationTemplate): Promise<void> {
  if (!isFirebaseReady()) {
    const current = await listCustomizationTemplates(merchantId);
    storage.set(merchantId, JSON.stringify([...current.filter(item => item.id !== template.id), template]));
    return;
  }
  await updateDoc(doc(collection(getFirestore(getApp()), 'merchants'), merchantId), {
    [`customizationTemplates.${template.id}`]: template.group,
  });
}
