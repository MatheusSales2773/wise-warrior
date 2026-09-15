/**
 * Resolução de tipo para o bundler/TypeScript. Em runtime nativo o Metro usa
 * `credential-store.native.ts`; na Web usa `credential-store.web.ts`.
 */
export { credentialStore } from './credential-store.native';
