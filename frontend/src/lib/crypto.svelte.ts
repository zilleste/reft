import _sodium from "libsodium-wrappers-sumo";
import { cachecache } from "./cachecache";
await _sodium.ready;
import z from "zod";

declare const encryptedStringTag: unique symbol;

export const EncryptedString: z.ZodType<EncryptedString, string> = z
  .string()
  .refine((s) => s === "" || s.startsWith("v1:")) as any;
export type EncryptedString = {
  [encryptedStringTag]: true;
};

const salt = "opalminiopalmini";
const storageKey = "opalmini-key";

let key = $state<Uint8Array | null>(
  localStorage.getItem(storageKey)
    ? new Uint8Array(JSON.parse(localStorage.getItem(storageKey) as string))
    : null
);

$effect.root(() => {
  $effect(() => {
    if (key) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(key)));
    } else {
      localStorage.removeItem(storageKey);
    }
  });
});

export const isPasswordSet = () => key !== null;

const encryptionCache = cachecache<string, EncryptedString>();
const decryptionCache = cachecache<EncryptedString, string>();

function deriveKey(password: string): Uint8Array {
  return _sodium.crypto_pwhash(
    _sodium.crypto_secretbox_KEYBYTES,
    password,
    new TextEncoder().encode(salt),
    _sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    _sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    _sodium.crypto_pwhash_ALG_ARGON2ID13
  );
}

export function setPassword(newPassword: string) {
  key = deriveKey(newPassword);
}

export function encryptEmpty(): EncryptedString {
  if (key === null) {
    return "" as unknown as EncryptedString;
  }
  return encrypt("");
}

/**
 * Returns the string in encrypted form. Throws if the password is not set.
 */
export const encrypt = (value: string): EncryptedString =>
  encryptionCache.get(value, () => {
    if (key === null) {
      throw new Error("Password not set");
    }

    const nonce = _sodium.randombytes_buf(_sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = _sodium.crypto_secretbox_easy(
      new TextEncoder().encode(value),
      nonce,
      key
    );

    // Efficient compact encoding: base64url of (nonce || ciphertext)
    const packed = new Uint8Array(nonce.length + ciphertext.length);
    packed.set(nonce, 0);
    packed.set(ciphertext, nonce.length);
    const b64 = _sodium.to_base64(
      packed,
      _sodium.base64_variants.URLSAFE_NO_PADDING
    );
    // Prefix with version for future-proofing and to distinguish from legacy JSON
    return (`v1:` + b64) as unknown as EncryptedString;
  });

/**
 * Returns the string in decrypted form, or an error message.
 */
export const decrypt = (value: EncryptedString): string => {
  try {
    return decryptionCache.get(value, () => {
      if (key === null) {
        throw new Error("PASSWORD MISSING");
      }

      try {
        const str = value as unknown as string;
        if (str === "") {
          return "";
        }
        // New compact format
        if (!str.startsWith("v1:")) {
          throw new Error("DATA CORRUPTED");
        }
        const packed = _sodium.from_base64(
          str.slice(3),
          _sodium.base64_variants.URLSAFE_NO_PADDING
        );
        const nonce = packed.slice(0, _sodium.crypto_secretbox_NONCEBYTES);
        const ciphertext = packed.slice(_sodium.crypto_secretbox_NONCEBYTES);
        const plaintext = _sodium.crypto_secretbox_open_easy(
          ciphertext,
          nonce,
          key
        );
        return new TextDecoder().decode(plaintext);
      } catch (e) {
        throw new Error("DECRYPTION FAILED");
      }
    });
  } catch (e) {
    return (e as Error).message;
  }
};
