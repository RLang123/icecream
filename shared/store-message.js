export const DEFAULT_STORE_HERO_MESSAGE = "오늘은 어떤 달콤함이 필요하세요?";
export const STORE_HERO_MESSAGE_MAX_LENGTH = 60;

export function normalizeStoreHeroMessage(value) {
  return String(value ?? "").trim();
}

export function storeHeroMessage(value) {
  return normalizeStoreHeroMessage(value) || DEFAULT_STORE_HERO_MESSAGE;
}
