import type { TablePreferences, TablePreferencesAdapter } from './DataTable.types';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function validPreferences(value: unknown, schemaVersion: number): value is TablePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<TablePreferences>;
  if (candidate.schemaVersion !== schemaVersion) return false;
  if (candidate.density !== 'dense' && candidate.density !== 'comfortable') return false;
  if (!Array.isArray(candidate.columnOrder) || candidate.columnOrder.some((item) => typeof item !== 'string' || item.length === 0)) return false;
  if (!candidate.columnVisibility || typeof candidate.columnVisibility !== 'object' || Array.isArray(candidate.columnVisibility)) return false;
  if (Object.values(candidate.columnVisibility).some((item) => typeof item !== 'boolean')) return false;
  if (!candidate.columnWidths || typeof candidate.columnWidths !== 'object' || Array.isArray(candidate.columnWidths)) return false;
  if (Object.values(candidate.columnWidths).some((item) => !Number.isFinite(item) || Number(item) <= 0)) return false;
  return true;
}

export function createLocalTablePreferencesAdapter(
  storage: StorageLike | null = browserStorage(),
  namespace = 'wingmanpm-design'
): TablePreferencesAdapter {
  const keyFor = (tableId: string) => `${namespace}:table:${tableId}`;
  return {
    async load(tableId, schemaVersion) {
      const raw = storage?.getItem(keyFor(tableId));
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!validPreferences(parsed, schemaVersion)) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    async save(tableId, schemaVersion, value) {
      storage?.setItem(keyFor(tableId), JSON.stringify({ ...value, schemaVersion }));
    },
    async reset(tableId) {
      storage?.removeItem(keyFor(tableId));
    }
  };
}

/**
 * Prefer an account/workspace adapter and fall back locally only when it is
 * unavailable. A failed primary save still writes the local view, but does not
 * hide the primary error from the caller.
 */
export function createLayeredTablePreferencesAdapter(
  primary: TablePreferencesAdapter | undefined,
  fallback: TablePreferencesAdapter = createLocalTablePreferencesAdapter()
): TablePreferencesAdapter {
  if (!primary) return fallback;
  return {
    async load(tableId, schemaVersion) {
      try {
        return (await primary.load(tableId, schemaVersion)) ?? fallback.load(tableId, schemaVersion);
      } catch {
        return fallback.load(tableId, schemaVersion);
      }
    },
    async save(tableId, schemaVersion, value) {
      try {
        await primary.save(tableId, schemaVersion, value);
      } catch (error) {
        await fallback.save(tableId, schemaVersion, value);
        throw error;
      }
    },
    async reset(tableId) {
      await Promise.allSettled([primary.reset(tableId), fallback.reset(tableId)]);
    }
  };
}
