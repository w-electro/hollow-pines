// Cross-origin isolation on a host that can't send headers (GitHub Pages).
//
// A page only gets multi-threaded WebAssembly (which the voice engine uses to speak
// in time) when it is "cross-origin isolated". That needs two response headers, which
// GitHub Pages won't send — so this service worker adds them to the game's own files.
// Files from other sites (jsDelivr, Hugging Face) pass through untouched.
// Same idea as coi-serviceworker by Guido Zuidhof (MIT).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return
  if (new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(req).then((res) => {
      if (res.status === 0) return res
      const headers = new Headers(res.headers)
      headers.set('Cross-Origin-Opener-Policy', 'same-origin')
      headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
    }),
  )
})
