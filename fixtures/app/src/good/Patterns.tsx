import { useState } from 'react';
import { FontAwesomeIcon } from '../bad/icons';

// Patterns jsx-a11y flags but that are accessible. The action must stay silent on this file.

// dnd-kit's useSortable returns role, tabIndex and aria-* in `attributes` and key handlers in `listeners`.
declare function useSortable(args: { id: string }): {
  attributes: Record<string, unknown>;
  listeners: Record<string, () => void>;
};

function SortableItem({ id, onOpen }: { id: string; onOpen: () => void }) {
  const { attributes, listeners } = useSortable({ id });
  return (
    <li {...attributes} {...listeners} onClick={onOpen}>
      {id}
    </li>
  );
}

export function Patterns({ items, selectable }: { items: string[]; selectable: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      {/* Safari drops list semantics under list-style: none unless role="list" is explicit. */}
      <ul role="list">
        {items.map((id) => (
          <SortableItem key={id} id={id} onOpen={() => setOpen(true)} />
        ))}
      </ul>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Edit item" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <input aria-label="Name" autoFocus />
          <button type="button" onClick={() => setOpen(false)}>
            <FontAwesomeIcon icon="xmark" title="Close" />
          </button>
        </div>
      )}

      <img
        src="/chart.png"
        alt="Sales by month"
        role={selectable ? 'button' : undefined}
        tabIndex={selectable ? 0 : undefined}
        onClick={selectable ? () => setOpen(true) : undefined}
        onKeyDown={selectable ? () => setOpen(true) : undefined}
      />
    </div>
  );
}
