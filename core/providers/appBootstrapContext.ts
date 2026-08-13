import { createContext, useContext } from 'react';

export type AppBootstrapState = {
  authBootstrapReady: boolean;
};

const AppBootstrapStateContext = createContext<AppBootstrapState>({
  authBootstrapReady: false,
});

export function useAppBootstrapState(): AppBootstrapState {
  return useContext(AppBootstrapStateContext);
}

export { AppBootstrapStateContext };
