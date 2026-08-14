import { createContext, useContext } from 'react';
import type { AccountActionResult, AccountState } from '@/core/auth/account.types';

export type AppBootstrapState = {
  authBootstrapReady: boolean;
  accountState: AccountState;
  refreshAccountState: () => Promise<void>;
  protectAccount: (email: string) => Promise<AccountActionResult>;
  verifyAccountProtection: (token: string) => Promise<AccountActionResult>;
  resendAccountProtection: () => Promise<AccountActionResult>;
  requestAccountRecovery: (email: string) => Promise<AccountActionResult>;
  verifyAccountRecovery: (token: string) => Promise<AccountActionResult>;
  resendAccountRecovery: () => Promise<AccountActionResult>;
};

const AppBootstrapStateContext = createContext<AppBootstrapState>({
  authBootstrapReady: false,
  accountState: {
    status: 'remote_unavailable',
    email: null,
    isAnonymous: null,
    hasOwnerBinding: false,
    hasUserData: false,
    pendingOutboxCount: 0,
    canProtect: false,
    canRecoverExisting: false,
    canRecoverOwner: false,
    message: 'Account status is loading.',
    resendAvailableAt: null,
  },
  refreshAccountState: () => Promise.resolve(undefined),
  protectAccount: () =>
    Promise.resolve({
      ok: false,
      status: 'error',
      message: 'Account status is loading.',
    }),
  verifyAccountProtection: () =>
    Promise.resolve({
      ok: false,
      status: 'error',
      message: 'Account status is loading.',
    }),
  resendAccountProtection: () =>
    Promise.resolve({
      ok: false,
      status: 'error',
      message: 'Account status is loading.',
    }),
  requestAccountRecovery: () =>
    Promise.resolve({
      ok: false,
      status: 'error',
      message: 'Account status is loading.',
    }),
  verifyAccountRecovery: () =>
    Promise.resolve({
      ok: false,
      status: 'error',
      message: 'Account status is loading.',
    }),
  resendAccountRecovery: () =>
    Promise.resolve({
      ok: false,
      status: 'error',
      message: 'Account status is loading.',
    }),
});

export function useAppBootstrapState(): AppBootstrapState {
  return useContext(AppBootstrapStateContext);
}

export { AppBootstrapStateContext };
