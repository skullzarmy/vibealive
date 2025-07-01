import { AnalysisPlugin, AnalysisContext, PluginResult, FileAnalysis, Recommendation } from '../types';

export class TailwindAnalyzer implements AnalysisPlugin {
  name = 'tailwind';

  async analyze(context: AnalysisContext): Promise<PluginResult> {
    const findings: FileAnalysis[] = [];
    const recommendations: Recommendation[] = [];
    
    // Find Tailwind config file
    const tailwindConfig = context.files.find(file => 
      file.includes('tailwind.config.') || file.includes('tailwind.config')
    );
    
    if (!tailwindConfig) {
      return { findings, recommendations };
    }
    
    // Check for unused Tailwind classes
    // This is a simplified implementation
    recommendations.push({
      type: 'OPTIMIZE',
      target: 'Tailwind CSS',
      confidence: 70,
      impact: 'MEDIUM',
      description: 'Consider purging unused Tailwind classes to reduce bundle size',
      actions: [
        'Review Tailwind config for proper purge settings',
        'Use Tailwind JIT mode for better tree-shaking'
      ]
    });
    
    return {
      findings,
      recommendations,
      metadata: {
        tailwindConfigFound: true,
        configPath: tailwindConfig
      }
    };
  }
}

export class SupabaseAnalyzer implements AnalysisPlugin {
  name = 'supabase';

  async analyze(context: AnalysisContext): Promise<PluginResult> {
    const findings: FileAnalysis[] = [];
    const recommendations: Recommendation[] = [];
    
    // Check for Supabase client usage
    const supabaseFiles = context.files.filter(file => 
      file.includes('supabase') || file.includes('@supabase/')
    );
    
    if (supabaseFiles.length === 0) {
      return { findings, recommendations };
    }
    
    // Add Supabase-specific analysis
    recommendations.push({
      type: 'OPTIMIZE',
      target: 'Supabase Client',
      confidence: 80,
      impact: 'LOW',
      description: 'Ensure Supabase client is properly configured and not duplicated',
      actions: [
        'Check for single Supabase client instance',
        'Verify environment variables are properly set'
      ]
    });
    
    return {
      findings,
      recommendations,
      metadata: {
        supabaseFilesCount: supabaseFiles.length
      }
    };
  }
}

export class ServerActionsAnalyzer implements AnalysisPlugin {
  name = 'server-actions';

  async analyze(context: AnalysisContext): Promise<PluginResult> {
    const findings: FileAnalysis[] = [];
    const recommendations: Recommendation[] = [];
    
    if (context.projectStructure.routerType !== 'app') {
      return { findings, recommendations };
    }
    
    // Find server action files
    const serverActionFiles = context.files.filter(file => {
      // Check if file contains "use server" directive
      // This would require reading file content in a real implementation
      return file.includes('action') || file.includes('server');
    });
    
    if (serverActionFiles.length > 0) {
      recommendations.push({
        type: 'OPTIMIZE',
        target: 'Server Actions',
        confidence: 75,
        impact: 'MEDIUM',
        description: 'Review server actions for proper usage and security',
        actions: [
          'Ensure server actions are properly validated',
          'Check for proper error handling',
          'Verify authentication where needed'
        ]
      });
    }
    
    return {
      findings,
      recommendations,
      metadata: {
        serverActionFiles: serverActionFiles.length
      }
    };
  }
}

export class MDXAnalyzer implements AnalysisPlugin {
  name = 'mdx';

  async analyze(context: AnalysisContext): Promise<PluginResult> {
    const findings: FileAnalysis[] = [];
    const recommendations: Recommendation[] = [];
    
    // Find MDX files
    const mdxFiles = context.files.filter(file => file.endsWith('.mdx'));
    
    if (mdxFiles.length === 0) {
      return { findings, recommendations };
    }
    
    // Check for proper MDX configuration
    const nextConfig = context.files.find(file => file.includes('next.config.'));
    
    if (!nextConfig) {
      recommendations.push({
        type: 'MIGRATE',
        target: 'MDX Configuration',
        confidence: 90,
        impact: 'HIGH',
        description: 'MDX files found but no Next.js MDX configuration detected',
        actions: [
          'Install @next/mdx package',
          'Configure next.config.js for MDX support',
          'Add MDX file extensions to pageExtensions'
        ]
      });
    }
    
    return {
      findings,
      recommendations,
      metadata: {
        mdxFilesCount: mdxFiles.length,
        hasNextConfig: !!nextConfig
      }
    };
  }
}
