import { createContext, useContext } from 'react';

/**
 * Forced text ink for colored Card faces (v2 §6 hero: "section bright face
 * with ink text or solid face with white text"). Lives in its own module so
 * `Text` and `Card` share it without a circular import. `null` = no override.
 */
export const CardInkContext = createContext<string | null>(null);

/** Reads the forced ink for text rendered inside a colored Card face. */
export function useCardInk(): string | null {
  return useContext(CardInkContext);
}
