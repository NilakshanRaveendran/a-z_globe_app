import type { CustomizationOrderProps } from './CustomizationOrder.types';
import { colors } from '@core/theme';
const mime = 'application/x-az-customization';
export function CustomizationOrder({ index, scope, onReorder, disabled, children }: CustomizationOrderProps) {
  return <div onDragOver={event => { if (!disabled && event.dataTransfer.types.includes(mime)) event.preventDefault(); }} onDrop={event => {
    if (disabled) return;
    try {
      const source = JSON.parse(event.dataTransfer.getData(mime));
      if (source.scope !== scope || !Number.isInteger(source.index)) return;
      event.preventDefault(); event.stopPropagation(); onReorder(source.index, index);
    } catch { /* Ignore unrelated file/text drops. */ }
  }}>{children(<span draggable={!disabled} aria-label="Drag to reorder" title="Drag to reorder" onDragStart={event => {
    event.stopPropagation(); event.dataTransfer.setData(mime, JSON.stringify({ scope, index })); event.dataTransfer.effectAllowed = 'move';
  }} style={{ display: 'flex', width: 32, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: disabled ? 'default' : 'grab', color: colors.textMuted, fontSize: 24 }}>≡</span>)}</div>;
}
