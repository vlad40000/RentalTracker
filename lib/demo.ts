export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function demoShowsRealTenantNames(): boolean {
  return process.env.DEMO_SHOW_REAL_TENANT_NAMES === "true";
}

export function requireDemoMode(): void {
  if (!isDemoMode()) throw new Error("This operation is available only when DEMO_MODE=true");
}
