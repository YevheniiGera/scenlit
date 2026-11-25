// The six-digit code an authenticator app would show (RFC 6238), so a scene can pass a two-step sign-in:
//   await fill("Code", totp(process.env.TOTP_SECRET));
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(secret) {
  let bits = "";
  for (const c of secret.toUpperCase().replace(/[^A-Z2-7]/g, "")) bits += ALPHABET.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
}

export function totp(secret, { at = Date.now(), step = 30, digits = 6 } = {}) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / step)));
  const mac = createHmac("sha1", base32(secret)).update(counter).digest(), o = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}
