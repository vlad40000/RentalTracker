type DemoEnvironment = Partial<Pick<NodeJS.ProcessEnv, "DEMO_MODE" | "DEMO_SHOW_REAL_TENANT_NAMES">>;

/**
 * This repository is currently the public sales demo. Demo access therefore
 * defaults on unless it is explicitly disabled with DEMO_MODE=false.
 *
 * Production hardening should invert this default before real rental data is
 * accepted.
 */
export function isDemoMode(env: DemoEnvironment = process.env): boolean {
  return env.DEMO_MODE?.trim().toLowerCase() !== "false";
}

export function demoShowsRealTenantNames(env: DemoEnvironment = process.env): boolean {
  return env.DEMO_SHOW_REAL_TENANT_NAMES === "true";
}

export function requireDemoMode(): void {
  if (!isDemoMode()) throw new Error("This operation is available only in demo mode");
}
