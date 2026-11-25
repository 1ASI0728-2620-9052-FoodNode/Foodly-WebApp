/**
 * Error thrown by the HTTP client for any non-2xx response, timeout or network failure.
 * `status` is 0 when no HTTP response was received.
 * `message` is always user-facing Spanish; `serverMessage` keeps the backend text for debugging.
 */
export class HttpError extends Error {
  constructor({ status, message, serverMessage = null, data = null, kind = 'http' }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.serverMessage = serverMessage;
    this.data = data;
    this.kind = kind; // 'http' | 'timeout' | 'network'
  }
}

const MESSAGES = Object.freeze({
  400: 'Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.',
  401: 'Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscas.',
  409: 'La operación entra en conflicto con el estado actual de los datos.',
  SERVER: 'El servicio no está disponible en este momento. Inténtalo más tarde.',
  GENERIC: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  TIMEOUT: 'La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo.',
  NETWORK: 'No pudimos conectarnos con el servidor. Revisa tu conexión.',
});

export function messageForStatus(status) {
  if (MESSAGES[status]) return MESSAGES[status];
  if (status >= 500) return MESSAGES.SERVER;
  return MESSAGES.GENERIC;
}

export const NETWORK_MESSAGES = Object.freeze({
  timeout: MESSAGES.TIMEOUT,
  network: MESSAGES.NETWORK,
});
