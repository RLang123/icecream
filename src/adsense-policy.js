export const ADSENSE_SCRIPT_ORIGIN = "https://pagead2.googlesyndication.com";
export const AD_ALLOWED_PATHS = new Set(["/about", "/guide"]);
const CLIENT_PATTERN = /^ca-pub-\d{16}$/;
const SLOT_PATTERN = /^\d{6,20}$/;

export function createAdsenseConfig(env = {}) {
  return {
    enabled: env.VITE_ADSENSE_ENABLED === "true",
    client: String(env.VITE_ADSENSE_CLIENT || "").trim(),
    slot: String(env.VITE_ADSENSE_CONTENT_SLOT || "").trim(),
  };
}

export function canLoadAdsense(pathname, config) {
  return AD_ALLOWED_PATHS.has(pathname) && config?.enabled === true && CLIENT_PATTERN.test(config.client || "");
}

export function canRenderAd(pathname, config) {
  return canLoadAdsense(pathname, config) && SLOT_PATTERN.test(config?.slot || "");
}
