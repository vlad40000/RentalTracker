import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationDir = path.join(here, "..", "migrations");
const files = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
const pool = new Pool({ connectionString: databaseUrl });

try {
  for (const file of files) {
    const sql = await readFile(path.join(migrationDir, file), "utf8");
    console.log(`Applying ${file}`);
    await pool.query(sql);
  }
  console.log("Migrations complete");
} finally {
  await pool.end();
}
