const fromB64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const toB64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));
async function key(): Promise<CryptoKey> {
  const encoded = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!encoded) throw new Error("TOKEN_ENCRYPTION_KEY is missing");
  const bytes = fromB64(encoded);
  if (bytes.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(value));
  return toB64(iv) + "." + toB64(new Uint8Array(cipher));
}
export async function decryptSecret(value: string): Promise<string> {
  const parts = value.split(".");
  if (parts.length !== 2) throw new Error("Invalid ciphertext");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(parts[0]) }, await key(), fromB64(parts[1]));
  return new TextDecoder().decode(plain);
}
