export function keysetAscCreatedAtId(cursorAt: Date, cursorId: string) {
  return {
    OR: [
      { createdAt: { gt: cursorAt } },
      { AND: [{ createdAt: cursorAt }, { id: { gt: cursorId } }] },
    ],
  };
}

export function keysetDescCreatedAtId(cursorAt: Date, cursorId: string) {
  return {
    OR: [
      { createdAt: { lt: cursorAt } },
      { AND: [{ createdAt: cursorAt }, { id: { lt: cursorId } }] },
    ],
  };
}