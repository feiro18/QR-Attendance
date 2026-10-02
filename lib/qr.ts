export type QRPayload = {
  v: 1;
  event: string;
  title?: string;
  start?: string;
  end?: string;
};

export type ParseQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; message: string };

export function buildQRPayload(event: {
  eventId: string;
  title: string;
  start?: string;
  end?: string;
}): string {
  const payload: QRPayload = { v: 1, event: event.eventId };
  if (event.title) payload.title = event.title;
  if (event.start) payload.start = event.start;
  if (event.end) payload.end = event.end;
  return JSON.stringify(payload);
}

export function parseQRPayload(raw: string): ParseQRResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  const values = parsed as Record<string, unknown>;
  if (values.v !== 1 || typeof values.event !== 'string' || !values.event.trim()) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  const optionalString = (key: 'title' | 'start' | 'end') =>
    typeof values[key] === 'string' ? values[key] : undefined;

  return {
    ok: true,
    payload: {
      v: 1,
      event: values.event,
      title: optionalString('title'),
      start: optionalString('start'),
      end: optionalString('end'),
    },
  };
}