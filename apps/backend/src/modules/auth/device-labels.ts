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

/** A Web só pode se rotular como Web; iOS/Android são exclusivos do transporte nativo. */
export const WEB_DEVICE_LABELS = [DEVICE_LABELS.web];

export const NATIVE_DEVICE_LABELS = [DEVICE_LABELS.ios, DEVICE_LABELS.android];
