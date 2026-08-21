import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/v1$/, '') ??
  'http://localhost:3000';

let socket: Socket | null = null;

/**
 * Abre a conexão de tempo real autenticada. O backend entra essa conexão
 * automaticamente na room `user:{id}` (ADR-009) — cada dispositivo logado
 * do mesmo usuário mantém sua própria conexão e recebe os mesmos eventos.
 */
export function connectSocket(accessToken: string): Socket {
  socket?.disconnect();
  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    withCredentials: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
