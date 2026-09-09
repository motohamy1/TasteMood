/**
 * Wikimedia Commons photo lookup (free, license-compliant source).
 *
 * Attribution is returned alongside the URL and stored in the database
 * (photoAttribution) so it can be surfaced at any time.
 */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'TasteMoodImporter/1.0 (https://tastemood.app; contact: dev@tastemood.app)';

export interface CommonsPhoto {
  url: string;
  attribution: string;
}

interface CommonsSearchResponse {
  query?: {
    pages?: Record<
      string,
      {
        title: string;
        imageinfo?: Array<{
          url: string;
          descriptionurl: string;
          extmetadata?: {
            Artist?: { value?: string };
            LicenseShortName?: { value?: string };
          };
        }>;
      }
    >;
  };
}

/** Find one geolocated Commons photo near a place, with attribution metadata. */
export async function findCommonsPhoto(
  latitude: number,
  longitude: number
): Promise<CommonsPhoto | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'geosearch',
    ggscoord: `${latitude}|${longitude}`,
    ggsradius: '150',
    ggslimit: '5',
    ggsnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '800',
  });

  const response = await fetch(`${COMMONS_API}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as CommonsSearchResponse;
  const pages = Object.values(payload.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.url || !/\.(jpe?g|png)$/i.test(info.url)) continue;
    const artist = stripHtml(info.extmetadata?.Artist?.value ?? '').trim();
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value ?? '').trim();
    const attribution = [artist || 'Wikimedia Commons contributor', license].filter(Boolean).join(' / ');
    const thumb = `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(page.title.replace(/^File:/, ''))}&w=800`;
    return { url: info.url.startsWith('//') ? `https:${info.url}` : thumb, attribution };
  }
  return null;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
}
