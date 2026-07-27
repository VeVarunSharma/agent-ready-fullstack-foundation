import { z } from "zod";

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f)) {
      return true;
    }
  }
  return false;
}

const relativeApplicationPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !containsControlCharacter(value),
    "The destination must be a relative application path.",
  );

export function parseRelativeApplicationPath(value: unknown): string | undefined {
  const result = relativeApplicationPathSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
