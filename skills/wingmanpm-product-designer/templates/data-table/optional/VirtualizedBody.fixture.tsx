import { useVirtualizer } from '@tanstack/react-virtual';
import type { CSSProperties, ReactElement, RefObject } from 'react';

type VirtualizedBodyProps<T> = {
  rows: T[];
  scrollElement: RefObject<HTMLElement | null>;
  estimateRowHeight?: number;
  renderRow: (row: T, index: number, style: CSSProperties) => ReactElement;
};

/**
 * Performance-lab fixture only. Do not ship until the semantic and keyboard
 * checks in this folder pass with the product's actual rows.
 */
export function VirtualizedBody<T>({
  rows,
  scrollElement,
  estimateRowHeight = 48,
  renderRow
}: VirtualizedBodyProps<T>) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8
  });
  return (
    <tbody style={{ position: 'relative', display: 'block', height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => renderRow(rows[virtualRow.index], virtualRow.index, {
        position: 'absolute',
        insetInline: 0,
        width: '100%',
        transform: `translateY(${virtualRow.start}px)`
      }))}
    </tbody>
  );
}
