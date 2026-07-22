// Single source of truth for file-name sanitization.
//
// Previously three hardcoded regex arrays (comment phrases, file types, branch
// names) lived here. They are now expressed as a SEED word list
// (DEFAULT_SANITIZER_WORDS) that is stored into settings on first run so every
// entry is visible and editable by a superadmin. At RUNTIME the sanitizer reads
// ONLY from the resolved settings list — no hardcoded arrays are applied.
//
// Ordering matters: multi-word tokens ("Requote Van") must precede their
// single-word substrings ("Requote", "Van") so overlaps are removed correctly.
// The seed preserves the original order, so default behavior is unchanged.

export interface SanitizerRule {
  word: string;
  enabled: boolean;
}

// Seed defaults — the exact values previously hardcoded, in the exact order
// they were applied. On first run these are written into global_settings so
// they appear in the File Name Sanitizer UI with zero manual migration.
export const DEFAULT_SANITIZER_WORDS: string[] = [
  // Comment phrases
  "check note",
  "expert please",
  "dot",
  // File types
  "Individual Review",
  "Other Site",
  "Requote Van",
  "Requote Bike",
  "Review Van",
  "Review Bike",
  "Requote",
  "Review",
  "Quote",
  "Sale",
  "Van",
  "Bike",
  // Branch names
  "PRIDE COMPARE",
  "EAZY COMPARE",
  "SWANDRIVE",
  "MIDDLESURE",
  "IRESURE",
  "BRISTOL",
  "SHEFFIELD",
  "PRIDE",
  "EAZY",
  "NOTTS",
  "RIDE",
  "SORT",
  "GET",
  "ADI",
  "AQ",
  "BC",
  "MK",
  "BI",
  "NN",
];

export const DEFAULT_SANITIZER_RULES: SanitizerRule[] = DEFAULT_SANITIZER_WORDS.map(
  (word) => ({ word, enabled: true }),
);

/**
 * Resolve the effective sanitizer rules. If the superadmin has saved rules,
 * use them verbatim. Otherwise (first run) SEED from the hardcoded defaults
 * plus any legacy `sanitizer_words` (the older custom-only field), de-duped —
 * so existing behavior is preserved and the list is never empty.
 */
export const resolveSanitizerRules = (
  storedRules?: SanitizerRule[] | null,
  legacyWords?: string[] | null,
): SanitizerRule[] => {
  if (Array.isArray(storedRules) && storedRules.length > 0) {
    return storedRules
      .filter((r) => r && typeof r.word === "string" && r.word.trim() !== "")
      .map((r) => ({ word: r.word.trim(), enabled: r.enabled !== false }));
  }
  const seen = new Set<string>();
  const rules: SanitizerRule[] = [];
  for (const word of [...DEFAULT_SANITIZER_WORDS, ...(legacyWords ?? [])]) {
    const key = String(word).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rules.push({ word: String(word).trim(), enabled: true });
  }
  return rules;
};

/** Enabled words only (what actually gets stripped). */
export const enabledSanitizerWords = (rules: SanitizerRule[]): string[] =>
  rules.filter((r) => r.enabled).map((r) => r.word);

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Compile a term into a case-insensitive, word-bounded regex. Multi-word terms
// match any run of whitespace between words.
const compileWord = (term: string): RegExp | null => {
  const trimmed = term.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).map(escapeRegExp);
  return new RegExp(`\\b${parts.join("\\s+")}\\b`, "gi");
};

/**
 * Build a sanitizer function from an explicit list of enabled words — the
 * single source of truth. Runs the same iterative strip + separator-collapse as
 * before.
 */
export const buildCleanFileName = (words: string[]) => {
  const regexes = words
    .map(compileWord)
    .filter((r): r is RegExp => r !== null);

  return (name: string): string => {
    if (!name) return "";
    let cleaned = name;

    let prev = "";
    let iterations = 0;
    while (cleaned !== prev && iterations < 5) {
      prev = cleaned;
      iterations++;
      for (const regex of regexes) cleaned = cleaned.replace(regex, "");
      cleaned = cleaned.replace(/[-\s.,()/\\]+/g, " ").trim();
    }

    return cleaned
      .replace(/^[-_.\s]+|[-_.\s]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };
};

/**
 * Legacy default entry point — applies the seed defaults. Used as the fallback
 * when no settings-derived list is provided (e.g. a component's default prop).
 */
export const cleanFileName = (name: string): string =>
  buildCleanFileName(DEFAULT_SANITIZER_WORDS)(name);
