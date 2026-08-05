import { createHash } from "node:crypto";

export type ExportPackage<T extends Record<string, unknown[]>> = {
  format: "rental-tracker-export";
  version: 1;
  createdAt: string;
  tables: T;
  checksum: string;
};

function canonicalize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function checksumTables(tables: Record<string, unknown[]>): string {
  return createHash("sha256").update(canonicalize(tables)).digest("hex");
}

export function createExportPackage<T extends Record<string, unknown[]>>(tables: T, createdAt = new Date().toISOString()): ExportPackage<T> {
  return {
    format: "rental-tracker-export",
    version: 1,
    createdAt,
    tables,
    checksum: checksumTables(tables),
  };
}

export function validateExportPackage(value: unknown): asserts value is ExportPackage<Record<string, unknown[]>> {
  if (!value || typeof value !== "object") throw new Error("Export file is not an object");
  const candidate = value as Partial<ExportPackage<Record<string, unknown[]>>>;
  if (candidate.format !== "rental-tracker-export" || candidate.version !== 1 || !candidate.tables || typeof candidate.checksum !== "string") {
    throw new Error("Unsupported or incomplete export file");
  }
  if (checksumTables(candidate.tables) !== candidate.checksum) throw new Error("Export checksum does not match its contents");
}

export function restoreIntoEmpty<T extends Record<string, unknown[]>>(current: T, exported: ExportPackage<T>): T {
  const hasRows = Object.values(current).some((rows) => rows.length > 0);
  if (hasRows) throw new Error("Restore target must be empty");
  validateExportPackage(exported);
  return structuredClone(exported.tables);
}
