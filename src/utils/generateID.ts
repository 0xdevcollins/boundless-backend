import crypto from "crypto";

export function generateID(): string {
  const randomId = crypto.randomBytes(8).toString("hex");
  return `boundless_${randomId}`;
}
