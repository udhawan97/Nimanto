export type ScopedRequestToken<Scope> = Readonly<{
  scope: Scope;
  generation: number;
}>;

export type ScopedRequestGate<Scope> = {
  select(scope: Scope | null): void;
  begin(scope: Scope): ScopedRequestToken<Scope> | null;
  isCurrent(token: ScopedRequestToken<Scope>): boolean;
  finish(token: ScopedRequestToken<Scope>): boolean;
};

/** Coordinates one read stream without absorbing its request or result shape.
 * Selecting another scope invalidates the old result immediately, while a
 * second request for the current scope is rejected until the first settles. */
export function createScopedRequestGate<Scope>(): ScopedRequestGate<Scope> {
  let selected: Scope | null = null;
  let generation = 0;
  let active: ScopedRequestToken<Scope> | null = null;

  return {
    select(scope) {
      if (Object.is(scope, selected)) return;
      selected = scope;
      generation += 1;
      active = null;
    },
    begin(scope) {
      if (!Object.is(scope, selected) || active) return null;
      active = { scope, generation };
      return active;
    },
    isCurrent(token) {
      return (
        active === token && Object.is(selected, token.scope) && token.generation === generation
      );
    },
    finish(token) {
      if (!this.isCurrent(token)) return false;
      active = null;
      return true;
    },
  };
}
