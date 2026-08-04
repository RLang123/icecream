import React, { useEffect } from "react";
import {
  ADSENSE_SCRIPT_ORIGIN,
  canLoadAdsense,
  canRenderAd,
  createAdsenseConfig,
} from "./adsense-policy.js";

export function adsenseConfig(env = import.meta.env || {}) {
  return createAdsenseConfig(env);
}

export function AdSenseLoader({ pathname, config = adsenseConfig() }) {
  const active = canLoadAdsense(pathname, config);
  useEffect(() => {
    if (!active || document.querySelector("script[data-geno-adsense]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.genoAdsense = "true";
    script.src = `${ADSENSE_SCRIPT_ORIGIN}/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.client)}`;
    document.head.appendChild(script);
  }, [active, config.client]);
  return null;
}

export function AdSlot({ pathname, config = adsenseConfig(), label = "광고" }) {
  const active = canRenderAd(pathname, config);
  useEffect(() => {
    if (!active) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [active, pathname, config.slot]);
  if (!active) return null;
  return (
    <aside className="content-ad" aria-label={label}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={config.client}
        data-ad-slot={config.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
