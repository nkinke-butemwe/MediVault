// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add security headers to every response
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevents click-jacking by disallowing iframes from other origins
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevents MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Forces HTTPS (only effective in production behind HTTPS)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Basic Content Security Policy
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Controls what info is sent in the Referer header
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restricts browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
