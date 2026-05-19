const TOKEN = 'B2e5n8hH4Ivqjui';
const SERVERS = ['p164','p01','p04','p06','p10','p23','p36','p58','p73'];

async function tryFetch(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function findHost() {
  // Try servers until one responds with the actual host or with photos
  for (const s of SERVERS) {
    const j = await tryFetch(
      `https://${s}-sharedstreams.icloud.com/${TOKEN}/sharedstreams/webstream`,
      { streamCtag: null }
    ).catch(() => null);
    if (!j) continue;
    if (j['X-Apple-MMe-Host']) return { host: j['X-Apple-MMe-Host'], photos: null };
    if (Array.isArray(j.photos)) return { host: `${s}-sharedstreams.icloud.com`, photos: j.photos };
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const result = await findHost();
    if (!result) return res.json({ urls: [], debug: 'no host found' });

    let { host, photos } = result;

    // If redirect gave us a host but no photos yet, fetch from correct host
    if (!photos) {
      const j2 = await tryFetch(
        `https://${host}/${TOKEN}/sharedstreams/webstream`,
        { streamCtag: null }
      );
      photos = (j2 && j2.photos) || [];
    }

    if (!photos.length) return res.json({ urls: [], debug: 'album empty' });

    // Pick latest 5
    const latest = [...photos]
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
      .slice(0, 5);

    const guids = latest.map(p => p.photoGuid);

    // Get CDN URLs
    const j3 = await tryFetch(
      `https://${host}/${TOKEN}/sharedstreams/webasseturls`,
      { photoGuids: guids }
    );
    const items = (j3 && j3.items) || {};

    const urls = guids.map(guid => {
      const item = items[guid];
      if (!item) return null;
      const loc  = item.url_location;
      const path = item.url_path;
      return (loc && path) ? `https://${loc}${path}` : null;
    }).filter(Boolean);

    res.json({ urls, count: photos.length });
  } catch (e) {
    res.status(500).json({ urls: [], error: e.message });
  }
};
