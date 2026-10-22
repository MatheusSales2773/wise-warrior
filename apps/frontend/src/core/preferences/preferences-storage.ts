/**
 * Resolução de tipo para o bundler/TypeScript. Em runtime nativo o Metro usa
 * `preferences-storage.native.ts`; na Web usa `preferences-storage.web.ts`.
 */
export { preferencesStorage } from './preferences-storage.native';
