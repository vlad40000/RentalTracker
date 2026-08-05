export function dollarsToCents(value: string | number): number {
  const normalized = typeof value === "number" ? value.toString() : value.trim().replace(/[$,]/g, "");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Enter a valid dollar amount with no more than two decimals");
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, decimal = ""] = unsigned.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Dollar amount is too large");
  return negative ? -cents : cents;
}

export function formatMoney(cents: number | bigint | string): string {
  const value = typeof cents === "bigint" ? Number(cents) : typeof cents === "string" ? Number(cents) : cents;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}

export function toSafeCents(value: string | number | bigint): number {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("Money value exceeds the supported safe integer range");
  return parsed;
}
