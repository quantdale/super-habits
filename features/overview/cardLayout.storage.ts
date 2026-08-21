import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseCardLayout, serializeCardLayout, type OverviewCardId } from './overview.domain';

const CARD_LAYOUT_STORAGE_KEY = 'superhabits.overview.cardLayout';

/** Load the persisted visible-card ordering; falls back to the default layout. */
export async function loadCardLayout(): Promise<OverviewCardId[]> {
  try {
    const raw = await AsyncStorage.getItem(CARD_LAYOUT_STORAGE_KEY);
    return parseCardLayout(raw);
  } catch {
    return parseCardLayout(null);
  }
}

/** Persist the visible-card ordering. Throws on storage failure after callers decide. */
export async function saveCardLayout(layout: readonly OverviewCardId[]): Promise<void> {
  await AsyncStorage.setItem(CARD_LAYOUT_STORAGE_KEY, serializeCardLayout(layout));
}
