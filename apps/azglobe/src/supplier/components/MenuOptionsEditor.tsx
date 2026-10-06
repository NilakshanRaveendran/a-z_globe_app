import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Text, Icon } from '@core/ui';
import { APP_MAX_WIDTH, colors, fontFamily } from '@core/theme';
import { CustomizationOrder } from './CustomizationOrder';
import { SupplierField } from './SupplierField';
import { copyOptions, draftOptions, optionId, optionTemplate, parseOptions, quickChoices, type DraftOptionGroup } from '../services/menuOptions';
import { listCustomizationTemplates, saveCustomizationTemplate, type CustomizationTemplate } from '../services/customizationTemplates';

type Props = { groups: DraftOptionGroup[]; onChange: (groups: DraftOptionGroup[]) => void; disabled: boolean; merchantId: string; dishName: string; basePrice: string };
function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const next = [...items]; const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!); return next;
}
const presets = ['Size', 'Spice Level', 'Add-ons', 'Extras', 'Portion', 'Cooking Preference'];
const summary = (group: DraftOptionGroup) => `${group.type === 'single' ? 'Choose one' : 'Choose multiple'} · ${group.required ? 'Required' : 'Optional'} · ${group.choices.length} choices`;
const priceLabel = (price: string) => Number(price) === 0 ? 'Free' : `+ Rs. ${price}`;

function Action({ label, onPress, disabled, danger = false }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, disabled && { opacity: 0.4 }]}><Text variant="labelMd" color={danger ? colors.status.danger : colors.primary}>{label}</Text></Pressable>;
}

function GroupCard({ group, expanded, onToggle, onChange, disabled, children, handle }: {
  group: DraftOptionGroup; expanded: boolean; onToggle: () => void; onChange: (group: DraftOptionGroup) => void; disabled: boolean; children?: React.ReactNode; handle?: React.ReactNode;
}) {
  const [narrow, setNarrow] = useState(false);
  const [settings, setSettings] = useState(false);
  const [bulk, setBulk] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [focusId, setFocusId] = useState<string>();
  const inputs = useRef<Record<string, TextInput | null>>({});
  useEffect(() => { if (focusId) inputs.current[focusId]?.focus(); }, [focusId, group.choices.length]);
  const update = (edits: Partial<DraftOptionGroup>) => onChange({ ...group, ...edits });
  const addChoice = () => {
    const empty = group.choices.find(choice => !choice.label.trim());
    if (empty) { setFocusId(empty.id); inputs.current[empty.id]?.focus(); return; }
    const choice = { id: optionId(), label: '', price: '0' };
    update({ choices: [...group.choices, choice] }); setFocusId(choice.id);
  };
  const defaultId = group.choices.some(choice => choice.id === group.defaultChoiceId) ? group.defaultChoiceId : group.required ? group.choices[0]?.id : undefined;
  return <View style={styles.card} onLayout={event => setNarrow(event.nativeEvent.layout.width < 340)}>
    <View style={styles.headerRow}>{handle}<Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Edit'} ${group.label || 'customization'}`} accessibilityState={{ expanded }} onPress={onToggle} style={styles.cardHeader}>
      <View style={styles.flex}><Text variant="h4">{group.label || 'New customization'}</Text><Text variant="bodySm" color={colors.textSecondary}>{summary(group)}</Text></View>
      <Text variant="labelMd" color={colors.primary}>{expanded ? 'Done' : 'Edit'}</Text>
    </Pressable></View>
    {expanded ? <View style={styles.cardBody}>
      <View style={styles.between}><Text variant="labelMd" color={colors.textSecondary}>Choice</Text><Text variant="labelMd" color={colors.textSecondary}>Extra charge</Text></View>
      {group.choices.map((choice, choiceIndex) => <CustomizationOrder key={choice.id} index={choiceIndex} scope={group.key} disabled={disabled || !settings} onReorder={(from, to) => update({ choices: reorder(group.choices, from, to) })}>{choiceHandle => <View style={styles.choiceRow}>
        {settings ? choiceHandle : null}
        <TextInput ref={node => { inputs.current[choice.id] = node; }} editable={!disabled} value={choice.label} placeholder="Choice name" placeholderTextColor={colors.textMuted} accessibilityLabel={`${group.label} choice name`} maxLength={60} style={[styles.input, styles.flex, (narrow || settings) && styles.wideInput]} onChangeText={label => update({ choices: group.choices.map(c => c.id === choice.id ? { ...c, label } : c) })} returnKeyType="next" onSubmitEditing={addChoice} />
        <View style={styles.price}>{Number(choice.price) !== 0 ? <Text variant="bodySm" color={colors.textSecondary}>+ Rs.</Text> : null}<TextInput editable={!disabled} value={choice.price === '0' ? '' : choice.price} placeholder="Free" placeholderTextColor={colors.textSecondary} accessibilityLabel={`Extra price for ${choice.label || 'new choice'}`} keyboardType="decimal-pad" inputMode="decimal" style={styles.priceInput} onChangeText={price => update({ choices: group.choices.map(c => c.id === choice.id ? { ...c, price: price || '0' } : c) })} onSubmitEditing={addChoice} /></View>
        {group.type === 'single' ? <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Default choice: ${choice.label}`} accessibilityState={{ selected: defaultId === choice.id }} onPress={() => update({ defaultChoiceId: !group.required && defaultId === choice.id ? undefined : choice.id })} style={styles.icon}><Text style={{ fontSize: 24 }} color={defaultId === choice.id ? colors.primary : colors.textMuted}>{defaultId === choice.id ? '★' : '☆'}</Text></Pressable> : null}
        <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Remove ${choice.label || 'empty choice'} from ${group.label}`} onPress={() => update({ choices: group.choices.filter(c => c.id !== choice.id) })} style={styles.icon}><Icon name="close" size={18} color={colors.textSecondary} /></Pressable>
        {settings ? <View style={styles.row}><Action label={`Move ${choice.label || 'choice'} up`} disabled={disabled || choiceIndex === 0} onPress={() => update({ choices: reorder(group.choices, choiceIndex, choiceIndex - 1) })} /><Action label={`Move ${choice.label || 'choice'} down`} disabled={disabled || choiceIndex === group.choices.length - 1} onPress={() => update({ choices: reorder(group.choices, choiceIndex, choiceIndex + 1) })} /></View> : null}
      </View>}</CustomizationOrder>)}
      {settings ? <Text variant="bodySm" color={colors.textSecondary}>Drag handles to reorder choices.</Text> : null}
      {group.type === 'single' ? <Text variant="bodySm" color={colors.textSecondary}>★ marks the default choice.</Text> : null}
      <View style={styles.row}><Action label="+ Add choice" disabled={disabled} onPress={addChoice} /><Action label="Quick add choices" disabled={disabled} onPress={() => { setBulk(bulk === null ? '' : null); setError(''); }} /></View>
      {bulk !== null ? <View style={styles.settings}>
        <Text variant="bodySm">One per line, or separate with commas. Add +price for paid extras.</Text>
        <TextInput multiline editable={!disabled} accessibilityLabel={`Quick choices for ${group.label}`} placeholder={'Egg +100\nExtra gravy +30\nExtra rice +150'} placeholderTextColor={colors.textMuted} value={bulk} onChangeText={setBulk} style={[styles.input, styles.bulk]} />
        <Action label="Add choices" disabled={disabled} onPress={() => {
          try {
            const choices = [...group.choices.filter(c => c.label.trim()), ...quickChoices(bulk)];
            parseOptions([{ ...group, choices }]); update({ choices }); setBulk(null); setError('');
          } catch (e) { setError((e as Error).message); }
        }} />
      </View> : null}
      {error ? <Text variant="bodySm" color={colors.status.danger} accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={styles.divider} />
      <View style={styles.row}><Action label={settings ? 'Hide settings' : 'Settings & more'} onPress={() => setSettings(!settings)} />{settings ? children : null}</View>
      {settings ? <View style={styles.settings}>
        <SupplierField label="Customization name" value={group.label} editable={!disabled} onChangeText={label => update({ label })} maxLength={40} />
        <View style={styles.row}>{(['single', 'multi'] as const).map(type => <Pressable key={type} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: group.type === type }} onPress={() => update({ type })} style={[styles.chip, group.type === type && styles.selected]}><Text variant="labelMd" color={group.type === type ? colors.onPrimary : colors.primary}>{type === 'single' ? 'Choose one' : 'Choose multiple'}</Text></Pressable>)}</View>
        <View style={styles.between}><Text variant="bodyLg">Required selection</Text><Switch accessibilityLabel={`Require ${group.label}`} disabled={disabled} value={group.required} onValueChange={required => update({ required })} trackColor={{ true: colors.primary, false: colors.border }} /></View>
      </View> : null}
    </View> : null}
  </View>;
}

export function MenuOptionsEditor({ groups, onChange, disabled, merchantId, dishName, basePrice }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  // Remember toggled-off drafts so a second tap restores edited prices and choices.
  const toggledGroups = useRef<Record<string, { group: DraftOptionGroup; index: number }>>({});
  const presetKeys = useRef<Record<string, string>>({});
  const [templates, setTemplates] = useState<CustomizationTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; group: DraftOptionGroup } | null>(null);
  const [custom, setCustom] = useState<DraftOptionGroup | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewChoices, setPreviewChoices] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    listCustomizationTemplates(merchantId).then(value => { if (active) setTemplates(value); }).catch(() => { if (active) setNotice('Saved customizations could not load. Reopen to try again.'); });
    return () => { active = false; };
  }, [merchantId]);
  const uniqueName = (label: string) => {
    let candidate = label; let suffix = 2;
    while (groups.some(g => g.label.toLowerCase() === candidate.toLowerCase())) candidate = `${label} ${suffix++}`;
    return candidate;
  };
  const add = (group: DraftOptionGroup) => { const next = { ...group, label: uniqueName(group.label) }; onChange([...groups, next]); setExpanded(next.key); return next; };
  const activePreset = (label: string) => {
    const key = presetKeys.current[label];
    if (key) return groups.find(group => group.key === key);
    return groups.find(group => label === 'Custom'
      ? !Object.values(presetKeys.current).includes(group.key) && !presets.some(preset => preset.toLowerCase() === group.label.trim().toLowerCase())
      : group.label.trim().toLowerCase() === label.toLowerCase());
  };
  const togglePreset = (label: string) => {
    const current = activePreset(label);
    if (current) {
      presetKeys.current[label] = current.key;
      toggledGroups.current[label] = { group: current, index: groups.findIndex(group => group.key === current.key) };
      onChange(groups.filter(group => group.key !== current.key));
      if (expanded === current.key) setExpanded(null);
      return;
    }
    const saved = toggledGroups.current[label];
    if (saved) {
      const next = [...groups];
      next.splice(Math.min(saved.index, next.length), 0, saved.group);
      onChange(next); setExpanded(saved.group.key);
    } else if (label === 'Custom') {
      setCustom(optionTemplate('Custom'));
    } else {
      const group = add(optionTemplate(label));
      presetKeys.current[label] = group.key;
    }
  };
  const persistTemplate = async (group: DraftOptionGroup, id?: string) => {
    try {
      const parsed = parseOptions([group])[0]!;
      if (templates.some(template => template.id !== id && template.group.label.toLowerCase() === parsed.label.toLowerCase())) throw new Error('A saved customization already has this name. Edit that template or use a different name.');
      setSaving(true);
      const template = { id: id ?? optionId(), group: parsed }; await saveCustomizationTemplate(merchantId, template);
      setTemplates(current => [...current.filter(t => t.id !== id), template]); setEditingTemplate(null); setNotice(`Saved ${parsed.label} for reuse. Existing dishes stay unchanged.`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save customization. Try again.'); }
    finally { setSaving(false); }
  };
  const move = (index: number, direction: number) => onChange(reorder(groups, index, index + direction));
  const previewTotal = groups.reduce((total, group) => total + group.choices.filter(c => previewChoices[group.key]?.includes(c.id)).reduce((sum, c) => sum + (Number(c.price) || 0), 0), Number(basePrice) || 0);
  return <View style={styles.section}>
    <View style={styles.between}><Text variant="h3">Customizations</Text>{groups.length ? <Action label="Preview" onPress={() => {
      setPreviewChoices(Object.fromEntries(groups.map(group => [group.key, group.type === 'single' && (group.required || group.defaultChoiceId) ? [group.choices.find(c => c.id === group.defaultChoiceId)?.id ?? group.choices[0]?.id ?? ''] : []]))); setPreview(true);
    }} /> : null}</View>
    <Text variant="bodySm" color={colors.textSecondary}>Add sizes, spice levels, extras or other options customers can choose.</Text>
    <View style={styles.row}>{[...(more ? presets : presets.slice(0, 3)), 'Custom'].map(label => {
      const selected = Boolean(activePreset(label));
      return <Pressable key={label} disabled={disabled || saving} accessibilityRole="button" accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${label} group`} accessibilityState={{ selected }} style={[styles.chip, styles.presetChip, selected && styles.presetChipSelected]} onPress={() => togglePreset(label)}><Text variant="labelMd" color={colors.primary}>+ {label}</Text></Pressable>;
    })}<Action label={more ? 'Less' : 'More'} onPress={() => setMore(!more)} /></View>
    {!groups.length ? <Text variant="bodySm" color={colors.textSecondary}>No customizations yet. Start with a preset above.</Text> : null}
    {groups.map((group, index) => <CustomizationOrder key={group.key} index={index} scope="dish-groups" disabled={disabled} onReorder={(from, to) => onChange(reorder(groups, from, to))}>{handle => <GroupCard handle={handle} group={group} expanded={expanded === group.key} onToggle={() => setExpanded(expanded === group.key ? null : group.key)} onChange={next => onChange(groups.map(g => g.key === next.key ? next : g))} disabled={disabled || saving}>
      <Action label="Duplicate" disabled={disabled} onPress={() => add(copyOptions(group))} />
      <Action label="Save for reuse" disabled={disabled || saving} onPress={() => void persistTemplate(group)} />
      <Action label="Delete" danger disabled={disabled} onPress={() => onChange(groups.filter(g => g.key !== group.key))} />
      {groups.length > 1 ? <><Action label="Move up" disabled={disabled || index === 0} onPress={() => move(index, -1)} /><Action label="Move down" disabled={disabled || index === groups.length - 1} onPress={() => move(index, 1)} /></> : null}
    </GroupCard>}</CustomizationOrder>)}
    {templates.length ? <View style={styles.section}><Text variant="labelLg">Saved customizations</Text><Text variant="bodySm" color={colors.textSecondary}>Add a copy, then edit it for this dish.</Text>{templates.map(template => <View key={template.id} style={styles.between}><Action label={`+ ${template.group.label}`} disabled={disabled || saving} onPress={() => add(copyOptions(draftOptions([template.group])[0]!))} /><Action label={`Edit template: ${template.group.label}`} disabled={saving} onPress={() => { setNotice(''); setEditingTemplate({ id: template.id, group: draftOptions([template.group])[0]! }); }} /></View>)}</View> : null}
    {notice ? <Text variant="bodySm" accessibilityLiveRegion="polite">{notice}</Text> : null}
    <Modal visible={!!custom || !!editingTemplate || preview} transparent animationType="slide" onRequestClose={() => { if (!saving) { setCustom(null); setEditingTemplate(null); setPreview(false); } }}>
      <View style={styles.modalRoot}><View style={styles.sheet}>
        <View style={styles.between}><Text variant="h3">{preview ? 'Customer preview' : editingTemplate ? 'Edit saved template' : 'Create customization'}</Text><Action label="Close" disabled={saving} onPress={() => { setCustom(null); setEditingTemplate(null); setPreview(false); }} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.section}>
          {custom ? <><SupplierField label="Customization name" autoFocus value={custom.label} onChangeText={label => setCustom({ ...custom, label })} placeholder="e.g. Crust" maxLength={40} /><View style={styles.row}>{(['single', 'multi'] as const).map(type => <Pressable key={type} accessibilityRole="button" onPress={() => setCustom({ ...custom, type })} style={[styles.chip, custom.type === type && styles.selected]}><Text color={custom.type === type ? colors.onPrimary : colors.primary}>{type === 'single' ? 'Choose one' : 'Choose multiple'}</Text></Pressable>)}</View><View style={styles.between}><Text>Required selection</Text><Switch accessibilityLabel="Custom group required" value={custom.required} onValueChange={required => setCustom({ ...custom, required })} trackColor={{ true: colors.primary }} /></View><Action label="Create customization" disabled={!custom.label.trim()} onPress={() => { const group = add({ ...custom, label: custom.label.trim() }); presetKeys.current.Custom = group.key; setCustom(null); }} /></> : null}
          {editingTemplate ? <><Text variant="bodySm">Changes apply to future copies. Dishes already using this template keep their current options.</Text><GroupCard group={editingTemplate.group} expanded onToggle={() => {}} disabled={saving} onChange={group => setEditingTemplate({ ...editingTemplate, group })} /><Action label={saving ? 'Saving…' : 'Save template'} disabled={saving} onPress={() => void persistTemplate(editingTemplate.group, editingTemplate.id)} />{notice ? <Text color={colors.status.danger}>{notice}</Text> : null}</> : null}
          {preview ? <><Text variant="h4">{dishName || 'Your dish'}</Text><Text variant="bodyLg">Rs. {Number(basePrice) || 0}</Text>{groups.map(group => <View key={group.key} style={styles.section}><Text variant="h4">{group.label}{group.required ? ' *' : ' (Optional)'}</Text>{group.choices.map(choice => {
            const selected = previewChoices[group.key]?.includes(choice.id) ?? false;
            return <Pressable key={choice.id} accessibilityRole={group.type === 'single' ? 'radio' : 'checkbox'} accessibilityState={{ checked: selected }} onPress={() => setPreviewChoices(current => ({ ...current, [group.key]: group.type === 'single' ? selected && !group.required ? [] : [choice.id] : selected ? (current[group.key] ?? []).filter(id => id !== choice.id) : [...(current[group.key] ?? []), choice.id] }))} style={[styles.previewChoice, selected && styles.previewSelected]}><Text style={styles.flex}>{selected ? '✓  ' : ''}{choice.label}</Text><Text color={colors.textSecondary}>{priceLabel(choice.price)}</Text></Pressable>;
          })}</View>)}<Text variant="h4">Total: Rs. {previewTotal}</Text><Text variant="bodySm" color={colors.textSecondary}>Preview only — no item is added to your cart.</Text></> : null}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12 }, flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center', flexShrink: 1 },
  chip: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primaryTint, justifyContent: 'center' }, selected: { backgroundColor: colors.primary },
  presetChip: { backgroundColor: colors.surface },
  presetChipSelected: { backgroundColor: colors.primaryTint },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' }, headerRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 }, wideInput: { flexBasis: '100%' }, cardHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 }, cardBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap' },
  input: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, fontFamily: fontFamily[500], fontSize: 16, color: colors.text, backgroundColor: colors.surface },
  price: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 92, paddingLeft: 4 }, priceInput: { minHeight: 44, flex: 1, minWidth: 0, fontSize: 16, fontFamily: fontFamily[500], color: colors.text, padding: 0 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, divider: { height: 1, backgroundColor: colors.border },
  settings: { padding: 12, gap: 12, borderRadius: 12, backgroundColor: colors.surfaceAlt }, bulk: { minHeight: 104, textAlignVertical: 'top' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: colors.scrim }, sheet: { width: '100%', maxWidth: APP_MAX_WIDTH, maxHeight: '85%', padding: 20, paddingBottom: 36, gap: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  previewChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }, previewSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
});
