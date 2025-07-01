// Sample configuration file for Next.js Analyzer
module.exports = {
  // Files to exclude from analysis
  exclude: [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/*.stories.tsx",
    "**/*.stories.ts",
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/coverage/**",
    "**/temp/**",
    "**/backup/**"
  ],
  
  // Additional file patterns to include
  include: [
    "**/*.mdx"
  ],
  
  // Plugins to enable
  plugins: [
    "tailwind",
    "supabase",
    "mdx",
    "server-actions"
  ],
  
  // Minimum confidence threshold for recommendations (0-100)
  confidenceThreshold: 85,
  
  // Generate dependency graph visualization
  generateGraph: true,
  
  // Output formats to generate
  outputFormats: ["json", "md", "tsv"]
};
