export function toDb(value: number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  return Math.round(value * 100);
}

export function fromDb(paise: number | null | undefined): number {
  if (paise == null) {
    return 0;
  }
  return paise / 100;
}
