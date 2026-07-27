export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
export function getAppOrigin(): string {
  return new URL(requireEnv("APP_ORIGIN")).origin;
}

export function getAdminLogins(): Set<string> {
  return new Set(
    requireEnv("GITHUB_ADMIN_LOGINS")
      .split(",")
      .map((login) => login.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSecureCookie(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}
