const TOKEN = 'B2e5n8hH4Ivqjui';

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  try {
    // Step 1: discover correct host
    const j1 = await post(
      `https://p01-sharedstreams.icloud.com/${TOKEN}/sharedstreams/webstream`,
      { streamCtag: null }
    );
    const host = j1['X-Apple-MMe-Host'] || 'p01-sharedstreams.icloud.com';

    // Step 2: fetch photo list from correct host
    const j2 = await post(
      `https://${host}/${TOKEN}/sharedstreams/webstream`,
      { streamCtag: null }
    );
    const photos = j2.photos || [];

    if (!photos.length) return res.json({ urls: [] });

    // Step 3: pick latest 5
    const latest = [...photos]
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
      .slice(0, 5);

    const guids = latest.map(p => p.photoGuid);

    // Step 4: resolve CDN URLs
    const j3 = await post(
      `https://${host}/${TOKEN}/sharedstreams/webasseturls`,
      { photoGuids: guids }
    );
    const items = j3.items || {};

    const urls = guids.map(guid => {
      const item = items[guid];
      if (!item) return null;
      const loc  = item.url_location;
      const path = item.url_path;
      return loc && path ? `https://${loc}${path}` : null;
    }).filter(Boolean);

    res.json({ urls });
  } catch (e) {
    res.status(500).json({ urls: [], error: e.message });
  }
};
