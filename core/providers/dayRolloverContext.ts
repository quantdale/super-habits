import { createContext, useContext } from 'react';

export const DayRolloverContext = createContext(0);

export function useDayRolloverGeneration(): number {
  return useContext(DayRolloverContext);
}
