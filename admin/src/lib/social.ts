/**
 * Social platforms the shop footer can show. Stored in Firestore settings/social.items
 * as [{ id, platform, url, label?, active }]. Keep in sync with shop-web/src/lib/shopContact.js.
 * Logos and colours: shared/socialIcons.js.
 */
export type SocialLink = {
  id: string;
  platform: string;
  url: string;
  label?: string;
  /** Font Awesome 4.7 icon name, used for "Other" links (known platforms show their own logo). */
  icon?: string;
  active?: boolean;
};

export const SOCIAL_PLATFORMS: Record<string, { label: string; icon: string; placeholder: string }> = {
  instagram: { label: "Instagram", icon: "instagram", placeholder: "https://www.instagram.com/bagzappleservices" },
  facebook: { label: "Facebook", icon: "facebook-official", placeholder: "https://www.facebook.com/bagzappleservices" },
  x: { label: "X (Twitter)", icon: "twitter", placeholder: "https://x.com/bagzapplestore" },
  tiktok: { label: "TikTok", icon: "music", placeholder: "https://www.tiktok.com/@yourhandle" },
  whatsapp: { label: "WhatsApp", icon: "whatsapp", placeholder: "https://wa.me/256754558186" },
  snapchat: { label: "Snapchat", icon: "snapchat-ghost", placeholder: "https://www.snapchat.com/add/bagzmarvin" },
  youtube: { label: "YouTube", icon: "youtube-play", placeholder: "https://www.youtube.com/@yourchannel" },
  threads: { label: "Threads", icon: "at", placeholder: "https://www.threads.net/@yourhandle" },
  pinterest: { label: "Pinterest", icon: "pinterest", placeholder: "https://www.pinterest.com/yourhandle" },
  linkedin: { label: "LinkedIn", icon: "linkedin-square", placeholder: "https://www.linkedin.com/company/yourcompany" },
  telegram: { label: "Telegram", icon: "telegram", placeholder: "https://t.me/yourchannel" },
  other: { label: "Other", icon: "link", placeholder: "https://…" }
};

export function platformInfo(platform: string) {
  return SOCIAL_PLATFORMS[platform] || SOCIAL_PLATFORMS.other;
}
