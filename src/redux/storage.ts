import { createMMKV } from 'react-native-mmkv';

/**
 * Encrypted MMKV instance for redux-persist.
 * In production, replace with a key from secure storage or your app config.
 */
const REDUX_STORAGE_ID = 'redux-persist';
const REDUX_ENCRYPTION_KEY = 'wms-redux-secret-key'; // TODO: use secure key in production

const mmkv = createMMKV({
  id: REDUX_STORAGE_ID,
  encryptionKey: REDUX_ENCRYPTION_KEY,
});

/** redux-persist compatible storage (getItem/setItem/removeItem returning Promises). */
export const reduxStorage = {
  getItem: (key: string): Promise<string | null> => {
    const value = mmkv.getString(key);
    return Promise.resolve(value ?? null);
  },
  setItem: (key: string, value: string): Promise<void> => {
    mmkv.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    mmkv.remove(key);
    return Promise.resolve();
  },
};
