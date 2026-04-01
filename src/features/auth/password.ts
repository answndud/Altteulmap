import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${SCRYPT_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHash] = storedHash.split("$");

  if (
    algorithm !== SCRYPT_PREFIX ||
    !salt ||
    !expectedHash ||
    expectedHash.length !== KEY_LENGTH * 2
  ) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (expectedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
}
