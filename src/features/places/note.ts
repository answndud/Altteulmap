type ParsedPlaceNote = {
  source: string | null;
  collectedAt: string | null;
  phone: string | null;
  /** 구조화 항목을 뺀 나머지 문구. 없으면 null. */
  rest: string | null;
};

const FIELD_PATTERNS: Array<[keyof Omit<ParsedPlaceNote, "rest">, RegExp]> = [
  ["source", /^출처\s*:\s*(.*)$/u],
  ["collectedAt", /^수집일\s*:\s*(.*)$/u],
  ["phone", /^전화\s*:\s*(.*)$/u],
];

/**
 * 공공데이터 import가 note에 `출처: … / 수집일: … / 전화: …` 한 줄로 넣어 둔 값을
 * 항목별로 나눈다. 알 수 없는 조각은 `rest`에 그대로 남긴다.
 */
export function parsePlaceNote(note: string | null | undefined): ParsedPlaceNote {
  const result: ParsedPlaceNote = {
    source: null,
    collectedAt: null,
    phone: null,
    rest: null,
  };
  const leftovers: string[] = [];

  for (const rawPart of (note ?? "").split("/")) {
    const part = rawPart.trim();

    if (!part) {
      continue;
    }

    const matched = FIELD_PATTERNS.find(([, pattern]) => pattern.test(part));

    if (matched) {
      const [field, pattern] = matched;
      const value = pattern.exec(part)?.[1]?.trim() || null;

      result[field] = result[field] ?? value;
    } else {
      leftovers.push(part);
    }
  }

  result.rest = leftovers.length > 0 ? leftovers.join(" / ") : null;

  return result;
}
