import { sha256Hex } from '@/lib/checksum';

/**
 * Fixed domain separator for portable-backup owner fingerprints. The
 * fingerprint is SHA-256 of this prefix plus the durable owner UUID, so it is
 * unambiguous to this feature and one-way: the raw Supabase user UUID never
 * appears in a portable backup file.
 *
 * The fingerprint is COMPATIBILITY METADATA ONLY. It is not authentication,
 * it is never trusted from a user-editable file as authority, and it can
 * never set `account.owner_user_id` — owner binding remains controlled by
 * Recoverable Account V1 and the current verified session.
 */
export const PORTABLE_OWNER_DOMAIN = 'superhabits-portable-owner-v1:';

export function portableOwnerFingerprint(userId: string): string {
  return sha256Hex(PORTABLE_OWNER_DOMAIN + userId);
}
