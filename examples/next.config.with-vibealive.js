// Next.js integration with VibeAlive webpack plugin
const { VibeAliveWebpackPlugin } = require('vibealive/webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js configuration
  experimental: {
    // Next.js experimental features
  },
  
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add VibeAlive plugin in production builds
    if (!dev && !isServer) {
      config.plugins.push(
        new VibeAliveWebpackPlugin({
          // Plugin configuration
          projectPath: process.cwd(),
          confidenceThreshold: 80,
          failOnError: process.env.NODE_ENV === 'production',
          showWarnings: true,
          outputDir: './vibealive-reports',
          formats: ['json'],
          environments: ['production'],
          exclude: [
            '**/node_modules/**',
            '**/.next/**',
            '**/test/**',
            '**/__tests__/**'
          ]
        })
      );
    }
    
    return config;
  },
};

module.exports = nextConfig;