import { Territory } from '../models/territory.model';

interface TerritoryFilterable {
  state?: string;
  county?: string;
  zip_code?: string;
}

/** Returns true if the item matches any of the given territories. */
export function matchesTerritory(item: TerritoryFilterable, territories: Territory[]): boolean {
  if (!territories.length) return false;

  for (const t of territories) {
    const type = (t.territory_type || '').toLowerCase();

    if (type === 'state') {
      if (t.state && item.state && t.state.toLowerCase() === item.state.toLowerCase()) {
        return true;
      }
    } else if (type === 'county') {
      if (
        t.state && item.state && t.state.toLowerCase() === item.state.toLowerCase() &&
        t.county && item.county && t.county.toLowerCase() === item.county.toLowerCase()
      ) {
        return true;
      }
    } else if (type === 'zip') {
      if (t.zip_code && item.zip_code && t.zip_code === item.zip_code) {
        return true;
      }
    }
  }

  return false;
}

/** Filters an array of items to only those matching at least one territory. */
export function filterByTerritories<T extends TerritoryFilterable>(items: T[], territories: Territory[]): T[] {
  if (!territories.length) return [];
  return items.filter(item => matchesTerritory(item, territories));
}
