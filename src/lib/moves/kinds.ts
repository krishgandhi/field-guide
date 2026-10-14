/**
 * What each kind of move is called on screen. Moves covers more than
 * transactions — a starting job changing hands matters as much as a trade —
 * and this label is what tells you which one you're looking at.
 *
 * Import-free so the client list and the server pages share one copy.
 */
export const KIND_LABEL: Record<string, string> = {
  trade: "Trade",
  signing: "Signing",
  contract: "Contract",
  release: "Release",
  role: "Role change",
  injury: "Injury",
  coaching: "Coaching",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}
