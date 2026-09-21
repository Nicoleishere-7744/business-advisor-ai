// سوییچ provider دیتابیس بین sqlite (توسعه) و postgresql (پروداکشن)
// استفاده: node scripts/set-db-provider.mjs sqlite | postgresql
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ALLOWED = ["sqlite", "postgresql"];
const target = process.argv[2];

if (!ALLOWED.includes(target)) {
  console.error(`provider نامعتبر است. یکی از این‌ها را بده: ${ALLOWED.join(" | ")}`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

const updated = schema.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"(sqlite|postgresql)"/,
  `$1"${target}"`,
);

if (updated === schema) {
  console.log(`provider از قبل روی «${target}» بود؛ تغییری لازم نبود.`);
} else {
  writeFileSync(schemaPath, updated, "utf8");
  console.log(`provider دیتابیس روی «${target}» تنظیم شد.`);
}

console.log("یادت باشد DATABASE_URL را هم متناسب با همین provider تنظیم کنی.");
