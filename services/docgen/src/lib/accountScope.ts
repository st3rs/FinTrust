// Defense-in-depth for multi-tenant isolation.
//
// docgen authenticates with SUPABASE_SERVICE_ROLE_KEY, which BYPASSES Row-Level
// Security. That means the four RLS policies in migrations/002_docgen.sql do NOT
// protect docgen traffic — the ONLY thing keeping account A from reading account
// B's templates/documents is that every query filters `.eq("account_id", id)`.
//
// The subtle risk: if `accountId` is ever undefined/empty, a downstream
// `.eq("account_id", undefined)` may serialize into a query with no real
// constraint, silently returning another tenant's rows. This helper makes that
// case fail loudly (throw) at the top of every route, before any DB call.

/** Thrown when a request reaches a route without a usable account scope. */
export class MissingAccountScopeError extends Error {
  constructor() {
    super("Request has no account scope");
    this.name = "MissingAccountScopeError";
  }
}

/**
 * Returns a validated, non-empty accountId or throws MissingAccountScopeError.
 * Baseline guard: rejects undefined/null/empty/whitespace and returns the
 * trimmed value.
 *
 * OPTIONAL (you, non-breaking): tighten this to also assert the *shape* of the
 * id. accountId is a Supabase auth uid (a UUID) on both auth paths, so a UUID
 * check would catch a whole class of "wrong column wired in" bugs. Add it below
 * where marked if you want the stricter boundary — weigh it against the
 * false-rejection risk if account IDs ever stop being UUIDs.
 */
export function requireAccountScope(accountId: string | undefined | null): string {
  if (typeof accountId !== "string") throw new MissingAccountScopeError();
  const trimmed = accountId.trim();
  if (trimmed.length === 0) throw new MissingAccountScopeError();

  // OPTIONAL(you): add a UUID assertion here, e.g.
  //   if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed))
  //     throw new MissingAccountScopeError();

  return trimmed;
}
