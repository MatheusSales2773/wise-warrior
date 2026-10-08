import type { DeviceSession } from './api';

export function formatPlanTier(planTier: string): string {
  return planTier === 'premium' ? 'Plano premium' : 'Plano gratuito';
}

/** Prefers the label the client sent at login; falls back to a coarse reading of the user agent. */
export function describeDevice(device: Pick<DeviceSession, 'deviceLabel' | 'userAgent'>): string {
  const label = device.deviceLabel?.trim();
  if (label) return label;
  const agent = device.userAgent ?? '';
  if (/iphone|ipad|ios/i.test(agent)) return 'Dispositivo iOS';
  if (/android/i.test(agent)) return 'Dispositivo Android';
  if (/windows|macintosh|linux/i.test(agent)) return 'Navegador no computador';
  return 'Dispositivo desconhecido';
}
