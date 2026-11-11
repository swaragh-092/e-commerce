const STORAGE_KEY = 'storefrontCampaignAttribution';
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

export const getCampaignAttribution = (search = window.location.search) => {
  const params = new URLSearchParams(search);
  const current = Object.fromEntries(CAMPAIGN_KEYS.map((key) => [key, (params.get(key) || '').trim().slice(0, 255)]));
  try {
    if (current.utm_source) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      return { utmSource: current.utm_source, utmMedium: current.utm_medium, utmCampaign: current.utm_campaign };
    }
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
    return { utmSource: saved.utm_source || '', utmMedium: saved.utm_medium || '', utmCampaign: saved.utm_campaign || '' };
  } catch {
    return { utmSource: current.utm_source, utmMedium: current.utm_medium, utmCampaign: current.utm_campaign };
  }
};
