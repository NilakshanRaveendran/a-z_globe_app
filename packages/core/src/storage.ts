import { createMMKV } from 'react-native-mmkv';

export function createStorage(options: { id: string }) {
  return createMMKV(options);
}
