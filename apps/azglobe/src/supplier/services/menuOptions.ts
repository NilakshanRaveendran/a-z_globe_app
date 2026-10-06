import type { OptionGroup } from '@modules/food/types';
export type DraftOptionGroup = Omit<OptionGroup, 'choices'> & { choices: { id: string; label: string; price: string }[] };
export const draftOptions = (groups: OptionGroup[]): DraftOptionGroup[] => groups.map(group => ({ ...group, choices: group.choices.map(choice => ({ id: choice.id, label: choice.label, price: String(choice.priceDelta) })) }));
export function parseOptions(groups: DraftOptionGroup[]): OptionGroup[] {
  const labels = new Set<string>();
  return groups.map(group => {
    const label = group.label.trim();
    if (!label) throw new Error('Give every customization group a name.');
    if (labels.has(label.toLowerCase())) throw new Error(`Use a unique group name for ${label}.`);
    labels.add(label.toLowerCase());
    if (!group.choices.length) throw new Error(`Add at least one choice to ${label}, or remove the group.`);
    const names = new Set<string>();
    const choices = group.choices.map(choice => {
      const name = choice.label.trim();
      if (!name) throw new Error(`Give every choice in ${label} a name.`);
      if (names.has(name.toLowerCase())) throw new Error(`Each choice in ${label} needs a unique name.`);
      names.add(name.toLowerCase());
      if (!/^\d+(\.\d{1,2})?$/.test(choice.price.trim())) throw new Error(`Enter a valid extra price for ${name}. Use 0 for no extra charge.`);
      const priceDelta = Number(choice.price);
      if (!Number.isFinite(priceDelta)) throw new Error(`Enter a valid extra price for ${name}.`);
      return { id: choice.id, label: name, priceDelta };
    });
    return { key: group.key, label, type: group.type, required: group.required, choices,
      ...(group.type === 'single' && (group.required || choices.some(c => c.id === group.defaultChoiceId)) ? { defaultChoiceId: choices.some(c => c.id === group.defaultChoiceId) ? group.defaultChoiceId : choices[0]!.id } : {}) };
  });
}
export const optionId = () => `option-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export function optionTemplate(label: string): DraftOptionGroup {
  const presets: Record<string, string[]> = {
    Size: ['Small', 'Medium', 'Large'], 'Spice Level': ['Mild', 'Medium', 'Hot', 'Extra Hot'],
    'Add-ons': ['Extra cheese', 'Extra chicken', 'Egg', 'Extra sauce'], Extras: ['Extra gravy', 'Extra rice'],
    Portion: ['Regular', 'Large'], 'Cooking Preference': ['Well done', 'Medium', 'Rare'],
  };
  const choices = (presets[label] ?? ['']).map(name => ({ id: optionId(), label: name, price: '0' }));
  const required = label === 'Size' || label === 'Portion';
  return { key: optionId(), label: label === 'Custom' ? '' : label, type: ['Add-ons', 'Extras'].includes(label) ? 'multi' : 'single', required, choices,
    ...(required ? { defaultChoiceId: choices[label === 'Size' ? 1 : 0]!.id } : {}) };
}

/** A detached copy: editing this dish never changes another dish or saved template. */
export function copyOptions(group: DraftOptionGroup, label = group.label): DraftOptionGroup {
  const choices = group.choices.map(choice => ({ ...choice, id: optionId() }));
  const defaultIndex = group.choices.findIndex(choice => choice.id === group.defaultChoiceId);
  const { defaultChoiceId: _default, ...rest } = group;
  return { ...rest, label, key: optionId(), choices,
    ...(defaultIndex >= 0 ? { defaultChoiceId: choices[defaultIndex]!.id } : {}) };
}

/** Commas/newlines separate choices; a trailing +amount is the extra charge. */
export function quickChoices(text: string): DraftOptionGroup['choices'] {
  const entries = text.split(/[,\n]/).map(entry => entry.trim()).filter(Boolean);
  if (!entries.length) throw new Error('Enter at least one choice.');
  const choices = entries.map(entry => {
    const match = entry.match(/^(.*?)\s*\+\s*(?:Rs\.?\s*)?(\d+(?:\.\d{1,2})?)$/i);
    if (entry.includes('+') && !match) throw new Error(`Use a name followed by +price: ${entry}`);
    return { id: optionId(), label: (match?.[1] ?? entry).trim(), price: match?.[2] ?? '0' };
  });
  parseOptions([{ key: 'bulk', label: 'Quick choices', type: 'multi', required: false, choices }]);
  return choices;
}
