import { BadRequestException } from '@nestjs/common';

/**
 * The cursor carries the datetime as the exact text MySQL produced (microseconds included): a round trip through a
 * JavaScript Date keeps only milliseconds, so the cursor would sort just before the row it points at and repeat it.
 */
const MYSQL_DATETIME_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;

export interface DatetimeCursor {
  datetime: string;
  id: string;
}

export function encodeDatetimeCursor(datetimeText: string, id: string): string {
  return Buffer.from(JSON.stringify([datetimeText, id]), 'utf8').toString('base64url');
}

/** Throws 400 when the cursor is not one `encodeDatetimeCursor` produced. */
export function decodeDatetimeCursor(cursor: string): DatetimeCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed)
      && typeof parsed[0] === 'string' && MYSQL_DATETIME_TEXT.test(parsed[0])
      && typeof parsed[1] === 'string'
    ) {
      return { datetime: parsed[0], id: parsed[1] };
    }
  } catch {
    // Falls through to the validation error below.
  }
  throw new BadRequestException('Cursor inválido');
}
