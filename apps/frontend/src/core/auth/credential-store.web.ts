import type { CredentialStore } from './types';

/**
 * Web nunca possui armazenamento de credencial acessível ao JavaScript. O
 * refresh token vive apenas no cookie `httpOnly` definido pelo backend, então
 * leitura devolve vazio e escrita/remoção não fazem nada.
 */
export const credentialStore: CredentialStore = {
  read: async () => null,
  write: async () => undefined,
  remove: async () => undefined,
};
