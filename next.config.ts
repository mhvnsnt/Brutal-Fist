import type { NextConfig } from 'next';

const BANNON_MODELS_RAW =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['brutalfis4201.builtwithrocket.new'],
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  turbopack: {},
  typescript: {
    ignoreBuildErrors: true,
  },

  async rewrites() {
    // public/models/* takes precedence when the file exists locally.
    // Missing GitHub-sourced skins (not committed) proxy from mhvnsnt/Bannon.
    return [
      {
        source: '/models/:file',
        destination: `${BANNON_MODELS_RAW}/:file`,
      },
    ];
  },

  webpack(config, { dev }) {
if (dev) {
    config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      exclude: [/node_modules/],
      use: [{
        loader: '@dhiwise/component-tagger/nextLoader',
      }],
    });
  }

    return config;
  }
};

export default nextConfig;
