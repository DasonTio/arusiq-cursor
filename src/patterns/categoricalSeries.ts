/**
 * Split from `CategoricalChart.tsx` so that file exports only the component —
 * fast refresh requires a component-only module, same reason `PartIcon.tsx`
 * keeps its glyph data in `partGlyphs.ts`.
 *
 * @requirement FR-61
 */
import type { CategoricalSeriesSet, ChartSeries } from '../components/contracts.ts';

const SLOTS = 6;

/**
 * Narrow a runtime list to the six slots. Returns `null` — rather than
 * truncating — when the list is empty or longer than six: what to do about a
 * seventh property is a SCREEN decision (small multiples, or "top 6 and the
 * rest"), and silently dropping it is the one answer that is always wrong.
 */
export function asChartSeries(
  list: readonly ChartSeries[],
): CategoricalSeriesSet | null {
  if (list.length === 0 || list.length > SLOTS) return null;
  return list as unknown as CategoricalSeriesSet;
}
