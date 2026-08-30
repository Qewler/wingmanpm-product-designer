import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import type { ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

type ColumnReorderProviderProps = {
  children: ReactNode;
  columnIds: string[];
  onReorder: (sourceId: string, targetId: string) => void;
};

export function ColumnReorderProvider({ children, columnIds, onReorder }: ColumnReorderProviderProps) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const sourceId = String(event.operation.source?.id ?? '');
        const targetId = String(event.operation.target?.id ?? '');
        if (sourceId && targetId && sourceId !== targetId && columnIds.includes(sourceId) && columnIds.includes(targetId)) {
          onReorder(sourceId, targetId);
        }
      }}
    >
      {children}
    </DragDropProvider>
  );
}

type ColumnDragHandleProps = {
  id: string;
  index: number;
  label: string;
  disabled?: boolean;
};

export function ColumnDragHandle({ id, index, label, disabled = false }: ColumnDragHandleProps) {
  const { ref, handleRef, isDragging, isDropping, isDropTarget } = useSortable({
    id,
    index,
    type: 'wingman-table-column',
    disabled
  });

  const connectHeader = (element: HTMLSpanElement | null) => {
    ref(element?.closest('th') ?? null);
  };

  return (
    <span
      ref={connectHeader}
      className="wpd-column-drag-anchor"
      data-dragging={isDragging || undefined}
      data-dropping={isDropping || undefined}
      data-drop-target={isDropTarget || undefined}
    >
      <button
        ref={handleRef}
        className="wpd-column-drag-handle"
        type="button"
        aria-label={`Drag ${label} column. Move buttons are also available in Columns.`}
        disabled={disabled}
      >
        <GripVertical aria-hidden="true" size={13} />
      </button>
    </span>
  );
}
