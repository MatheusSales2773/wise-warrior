/**
 * Rótulos de dispositivo previsíveis e não sensíveis (M3). O backend registra
 * um destes valores em `sessions.device_label`; nunca hostname, nome do
 * aparelho ou identificador persistente.
 */
export const DEVICE_LABELS = {
  web: 'Wise Web',
  ios: 'Wise iOS',
  android: 'Wise Android',
} as const;

export type DeviceLabel = (typeof DEVICE_LABELS)[keyof typeof DEVICE_LABELS];
export type WebDeviceLabel = typeof DEVICE_LABELS.web;
export type NativeDeviceLabel =
  | typeof DEVICE_LABELS.ios
  | typeof DEVICE_LABELS.android;

/** A Web só pode se rotular como Web; iOS/Android são exclusivos do transporte nativo. */
export const WEB_DEVICE_LABELS: readonly WebDeviceLabel[] = [DEVICE_LABELS.web];

export const NATIVE_DEVICE_LABELS: readonly NativeDeviceLabel[] = [
  DEVICE_LABELS.ios,
  DEVICE_LABELS.android,
];
