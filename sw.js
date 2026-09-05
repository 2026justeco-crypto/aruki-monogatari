/* 文明の軌跡 — 手元に置いておく仕組み（2026-09-05）
 *
 * ★ねらい＝歩いて現地で聞くアプリなので、電波が弱いところでも動くようにする。
 *
 * ★入れ方の考え方
 *   ・全部を先に落とす（precache）ことはしない。音声だけで40MBあるため。
 *   ・「一度開いたものだけ」を手元に残す（ランタイムキャッシュ）。
 *     同じ物語をもう一度聞くとき、電波が無くても鳴る。
 *   ・置いておく数と日数に上限をつけ、端末を圧迫しないようにする。
 */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

if (workbox) {
  workbox.setConfig({ debug: false });

  const { registerRoute } = workbox.routing;
  const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;

  /* 本体（index.html）。新しい版が出ていれば拾い、
     つながらなければ手元のもので開く。 */
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'honbun',
      networkTimeoutSeconds: 4,
      plugins: [ new ExpirationPlugin({ maxEntries: 4 }) ]
    })
  );

  /* 台本。まず手元のものを出し、裏で新しいものを取ってくる。 */
  registerRoute(
    ({ url }) => url.pathname.endsWith('/story.json'),
    new StaleWhileRevalidate({
      cacheName: 'daihon',
      plugins: [ new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 }) ]
    })
  );

  /* 音声。いちばん重いので、一度読んだら手元に残す。
     ★上限200本・30日。1本あたり平均300KBなので、いっぱいでも60MBほど。

     ★ここが一手間かかる（2026-09-05 実測でわかった）。
     ブラウザは音声を「途中から」取りに行く（Range付きの求め方）。
     サーバーは 206 という「一部だけ」の返事をするので、そのままでは手元に残せない。
     そこで
       ① 求めるときは「途中から」を外して、まるごと取ってくる（200で残る）
       ② 次からは、手元のまるごとから必要な範囲を切り出して返す
     という順にする。②が RangeRequestsPlugin の役目。 */
  const まるごと取る = {
    requestWillFetch: async ({ request }) => {
      const h = new Headers(request.headers);
      h.delete('range');
      return new Request(request.url, { headers: h, credentials: request.credentials });
    }
  };

  registerRoute(
    ({ url }) => /\.(m4a|mp3|wav)$/i.test(url.pathname),
    new CacheFirst({
      cacheName: 'koe',
      plugins: [
        まるごと取る,
        new workbox.rangeRequests.RangeRequestsPlugin(),
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true })
      ]
    })
  );

  /* 絵。背景と立ち絵。 */
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'e',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true })
      ]
    })
  );

  /* 字体。Google Fonts は長く変わらないので、そのまま残す。 */
  registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
      cacheName: 'jitai',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 })
      ]
    })
  );

  /* 新しい版を入れたら、すぐ入れ替える */
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
}
