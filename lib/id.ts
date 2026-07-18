import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Canonical ID prefixes (entity → prefix). Use only these at call sites.
 * Format: {prefix}_{timestamp_ms}_{8_random_chars}
 *
 * | Entity              | Prefix |
 * |---------------------|--------|
 * | todos               | todo   |
 * | habits              | habit  |
 * | habit_completions   | hcmp   |
 * | calorie_entries     | cal    |
 * | saved_meals         | smeal  |
 * | workout_routine     | wrk    |
 * | workout_log         | wrk    |
 * | routine_exercise    | ex     |
 * | routine_exercise_set| eset   |
 * | workout_session_ex  | wsex   |
 * | pomodoro_sessions   | pom    |
 * | guest (app_meta)    | guest  |
 * | recurring todo ser. | rec    |
 */

const RANDOM_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function getRandomChars(length: number): string {
  const bytes =
    Platform.OS === 'web'
      ? crypto.getRandomValues(new Uint8Array(length))
      : Crypto.getRandomValues(new Uint8Array(length));

  let result = '';
  for (let i = 0; i < length; i++) {
    result += RANDOM_ALPHABET[bytes[i] % RANDOM_ALPHABET.length];
  }
  return result;
}

export function createId(prefix: string): string {
  const random = getRandomChars(8);
  return `${prefix}_${Date.now()}_${random}`;
}
