/** @type {import('next').NextConfig} */
// §84: Build-Kennung sichtbar machen — damit sofort erkennbar ist, welcher
// Stand tatsächlich läuft (Railway setzt RAILWAY_GIT_COMMIT_SHA).
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID:
      (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || 'lokal',
  },
}

module.exports = nextConfig
