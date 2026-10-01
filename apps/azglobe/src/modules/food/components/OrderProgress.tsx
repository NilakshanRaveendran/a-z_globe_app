import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from '@core/ui';
import { colors, radius, spacing } from '@core/theme';
import { trackerProgress, type Order, type OrderStatus } from '../types';

const NODES = ['Restaurant', 'Picked up', 'Delivered'] as const;
const GLYPHS = ['utensils', 'person', 'home'] as const;
/** Takeaway has no rider: the customer collects it once it's ready. */
const PICKUP_NODES = ['Restaurant', 'Ready', 'Collected'] as const;
const PICKUP_GLYPHS = ['utensils', 'check', 'store'] as const;

/**
 * The three-node order tracker — Figma Status Loader (91:3780) and
 * TrackOrderCard (3:943).
 *
 *   node      36pt circle · complete #22C55E, pending #E5E7EB (icon at 40%)
 *   label     Urbanist 500 10/15 · complete #22C55E, pending #9CA3AF
 *   connector 3pt pill track #E5E7EB, filled #22C55E
 *
 * The Status Loader's six variants map onto the eight statuses through
 * `trackerProgress`: nothing lit while 'new', Restaurant once accepted, the
 * first bar while preparing and ready, Picked up and the second bar once the
 * rider has it, everything when delivered.
 *
 * A cancelled or refunded order stops at the last stage it actually reached
 * and turns brand red (`tone="danger"`), so it can never read as delivered
 * (C9). Pass the timeline so that stage is known.
 *
 * Layout: node columns are fixed width and the connectors flex, so the three
 * labels stay evenly spread at any card width. Wrapping each node together with
 * its connector would stop the connector flexing and push the last node off the
 * edge.
 */
export function OrderProgress({
  status,
  timeline,
  orderType,
  tone,
  filled = false,
  pending = false,
}: {
  status: OrderStatus;
  timeline?: Order['timeline'];
  orderType?: Order['orderType'];
  /** Overrides the tone the status implies. */
  tone?: 'success' | 'danger';
  /** Fill every node regardless of status. */
  filled?: boolean;
  /** Draw nothing lit regardless of status. */
  pending?: boolean;
}) {
  const progress = trackerProgress({ status, timeline, orderType });
  const pickup = orderType === 'pickup';
  const labels = pickup ? PICKUP_NODES : NODES;
  const glyphs = pickup ? PICKUP_GLYPHS : GLYPHS;
  const nodes = pending ? 0 : filled ? 3 : progress.nodes;
  const bars = pending ? 0 : filled ? 2 : progress.bars;
  const accent = (tone ?? progress.tone) === 'danger' ? colors.primary : colors.success;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Order progress: ${nodes ? labels[nodes - 1] : 'waiting for the restaurant'}`}
    >
      {labels.map((label, i) => {
        const complete = i < nodes;
        return (
          <Fragment key={label}>
            <View style={styles.nodeColumn}>
              <View style={[styles.node, complete ? { backgroundColor: accent } : styles.nodeOff]}>
                <View style={complete ? undefined : styles.glyphOff}>
                  <Icon name={glyphs[i]!} size={20} color={colors.onPrimary} />
                </View>
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

            {i < labels.length - 1 ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: i < bars ? '100%' : '0%', backgroundColor: accent }]} />
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
