import "server-only";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  SECRET_SETTING_KEYS,
  SETTING_DEFAULTS,
  SETTING_ENV_FALLBACK,
  type SettingKey,
} from "@/lib/constants";

// خواندن/نوشتن تنظیمات پلتفرم.
// ترتیب اولویت: مقدار موجود در DB ← متغیر محیطی ← مقدار پیش‌فرض ← ""

function isSecret(key: SettingKey): boolean {
  return SECRET_SETTING_KEYS.includes(key);
}

function fromEnvOrDefault(key: SettingKey): string {
  const envName = SETTING_ENV_FALLBACK[key];
  const envValue = envName ? process.env[envName] : undefined;
  if (envValue !== undefined && envValue !== "") return envValue;
  return SETTING_DEFAULTS[key] ?? "";
}

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row || row.value === "") return fromEnvOrDefault(key);
  return row.isSecret ? decryptSecret(row.value) : row.value;
}

export async function getSettings<T extends SettingKey>(
  keys: readonly T[],
): Promise<Record<T, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...keys] } } });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const out = {} as Record<T, string>;
  for (const key of keys) {
    const row = byKey.get(key);
    if (!row || row.value === "") {
      out[key] = fromEnvOrDefault(key);
    } else {
      out[key] = row.isSecret ? decryptSecret(row.value) : row.value;
    }
  }
  return out;
}

export async function getSettingNumber(key: SettingKey, fallback: number): Promise<number> {
  const raw = await getSetting(key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getSettingBoolean(key: SettingKey, fallback = false): Promise<boolean> {
  const raw = (await getSetting(key)).trim().toLowerCase();
  if (raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "on";
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const secret = isSecret(key);
  const stored = secret ? encryptSecret(value) : value;
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: stored, isSecret: secret },
    update: { value: stored, isSecret: secret },
  });
}

export async function setSettings(entries: Partial<Record<SettingKey, string>>): Promise<void> {
  const keys = Object.keys(entries) as SettingKey[];
  for (const key of keys) {
    const value = entries[key];
    if (value === undefined) continue;
    await setSetting(key, value);
  }
}

/// آیا مقدار این تنظیم به‌صورت صریح در دیتابیس ذخیره شده است؟
export async function hasStoredValue(key: SettingKey): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return Boolean(row && row.value !== "");
}
