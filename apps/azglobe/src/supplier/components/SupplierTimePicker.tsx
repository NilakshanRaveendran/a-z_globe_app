import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from '@core/ui';
import { Sheet } from '@core/ui/Sheet';
import { colors } from '@core/theme';
import { normaliseTime } from '../services/restaurantValidation';
export type SupplierTimeFieldProps = { label: string; value: string; onChange: (value: string) => void; invalid?: boolean };
export function SupplierTimeField({ label, value, onChange, invalid }: SupplierTimeFieldProps) {
  const scrollColumns = useRef<(ScrollView | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(['7', '00', 'AM']);
  const start = () => { setDraft((normaliseTime(value) ?? '7:00 AM').split(/[: ]/)); setOpen(true); };
  const columns = [Array.from({ length: 12 }, (_, i) => String(i + 1)), Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), ['AM', 'PM']];
  return <View style={styles.field}>
    <Text variant="labelMd" color={colors.textSecondary}>{label} *</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}. Choose time`} onPress={start} style={[styles.control, invalid && { borderColor: colors.status.danger }]}>
      <Text variant="labelLg">{value}</Text><Icon name="clock" size={20} color={colors.primary} />
    </Pressable>
    <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
      <View style={styles.body}>
        <View style={styles.columns}>{columns.map((values, column) => <View key={column} style={styles.column}>
          <Text variant="labelMd" align="center">{['Hour', 'Minute', 'AM / PM'][column]}</Text>
          <ScrollView ref={node => { scrollColumns.current[column] = node; }} onContentSizeChange={() => scrollColumns.current[column]?.scrollTo({ y: Math.max(0, values.indexOf(draft[column] ?? '')) * 44, animated: false })} style={styles.options} nestedScrollEnabled contentOffset={{ x: 0, y: Math.max(0, values.indexOf(draft[column] ?? '')) * 44 }}>
            {values.map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${['Hour', 'Minute', 'Period'][column]} ${option}`} accessibilityState={{ selected: draft[column] === option }} onPress={() => setDraft(previous => previous.map((v, i) => i === column ? option : v))} style={[styles.option, draft[column] === option && styles.selected]}><Text variant="labelLg" color={draft[column] === option ? colors.surface : colors.text}>{option}</Text></Pressable>)}
          </ScrollView>
        </View>)}</View>
        <Button label="Done" onPress={() => { onChange(`${draft[0]}:${draft[1]} ${draft[2]}`); setOpen(false); }} />
      </View>
    </Sheet>
  </View>;
}
const styles = StyleSheet.create({
  field: { flex: 1, gap: 8 }, control: { minHeight: 52, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  body: { padding: 20, gap: 20 }, columns: { flexDirection: 'row', gap: 12 }, column: { flex: 1, gap: 8 }, options: { height: 176 }, option: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, selected: { backgroundColor: colors.primary },
});
