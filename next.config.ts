import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 로컬 개발용 임베디드 Postgres(WASM)는 번들링하지 않고 Node에서 그대로 불러온다.
  serverExternalPackages: ['@electric-sql/pglite'],
  async headers() {
    return [
      {
        source: '/:path*',
        // 공유 토큰이 담긴 경로가 지도 타일·폰트 서버로 새지 않도록 출처만 보낸다.
        headers: [{ key: 'Referrer-Policy', value: 'strict-origin' }],
      },
    ];
  },
};

export default nextConfig;
