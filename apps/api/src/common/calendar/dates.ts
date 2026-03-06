import { BadRequestException } from "@nestjs/common";

export function parseOptionalDate(input?: string | null): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ code: 'INVALID_DATE', message: 'Invalid date' });
  }
  return d;
}