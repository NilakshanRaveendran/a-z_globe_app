import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { trackerStage, type OrderStatus } from '../types';

const NODES = ['Restaurant', 'Picked up', 'Delivered'] as const;
const GLYPHS = ['🍲', '🛵', '🏠'] as const;

/**
 * The three-node order tracker — Figma Status Loader (91:3780) and
 * TrackOrderCard (3:943).
 *
 *   node      36pt circle · complete #22C55E, pending #E5E7EB (icon at 40%)
 *   label     Urbanist 500 10/15 · complete #22C55E, pending #9CA3AF
 *   connector 3pt pill track #E5E7EB, filled #22C55E
 *
 * The eight order statuses collapse onto these three via `trackerStage`.
 *
 * Order History (346:3748) reuses it for finished orders: a delivered order is
 * all green, a cancelled one all brand red — `tone="danger"` with the whole
 * track filled, which is how the frame draws it.
 *
 * Layout: node columns are fixed width and the connectors flex, so the three
 * labels stay evenly spread at any card width. Wrapping each node together with
 * its connector would stop the connector flexing and push the last node off the
 * edge.
 */
export function OrderProgress({
  status,
  tone = 'success',
  filled = false,
}: {
  status: OrderStatus;
  tone?: 'success' | 'danger';
  /** Fill every node regardless of status — a finished order in history. */
  filled?: boolean;
}) {
  const stage = filled ? NODES.length - 1 : trackerStage(status);
  const accent = tone === 'danger' ? colors.primary : colors.success;

  return (
    <View style={styles.row}>
      {NODES.map((label, i) => {
        const complete = i <= stage;
        return (
          <Fragment key={label}>
            <View style={styles.nodeColumn}>
              <View style={[styles.node, complete ? { backgroundColor: accent } : styles.nodeOff]}>
                <Text style={[styles.glyph, !complete && styles.glyphOff]}>{GLYPHS[i]}</Text>
              </View>
              <Text
                variant="caption"
                color={complete ? accent : colors.textMuted}
                align="center"
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>

            {i < NODES.length - 1 ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: i < stage ? '100%' : '0%', backgroundColor: accent }]} />
              </View>
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  nodeColumn: { alignItems: 'center', gap: spacing[2.5], width: 62 },
  node: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeOff: { backgroundColor: colors.border },
  glyph: { fontSize: 17, lineHeight: 22 },
  glyphOff: { opacity: 0.4 },
  track: {
    flex: 1,
    height: 3,
    marginHorizontal: spacing[1.5],
    // Sits level with the circles, not the labels below them.
    marginBottom: 21,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.success },
});
