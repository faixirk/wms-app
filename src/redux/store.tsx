import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import { combineReducers } from 'redux';
import { reduxStorage } from './storage';
import authReducer from './slices/auth';
import chatReducer from './slices/chat';

const persistConfig = {
  key: 'root',
  storage: reduxStorage,
  whitelist: ['auth'], // Deliberately not persisting chat to avoid stale messages unless requested later
};

const rootReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
