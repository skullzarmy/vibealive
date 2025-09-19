import * as path from 'path';
import { AnalysisConfig, ProjectStructure, APIEndpoint, HTTPMethod, Reference } from '../types';
import { ScannedFile } from '../scanners/file-scanner';

export class APIAnalyzer {
  constructor(
    private config: AnalysisConfig,
    private projectStructure: ProjectStructure
  ) {}

  public async analyzeAPIs(files: ScannedFile[]): Promise<APIEndpoint[]> {
    const apiFiles = files.filter((file) => this.isAPIFile(file));
    const sourceFiles = files.filter((file) => !this.isAPIFile(file));

    // 1. Single pass to find all potential API calls in the codebase
    const allCallSites = this.findAllAPICalls(sourceFiles);

    // 2. Analyze each API file against the collected call sites
    const apiEndpoints: APIEndpoint[] = [];
    for (const apiFile of apiFiles) {
      const endpoints = await this.analyzeAPIFile(apiFile, allCallSites);
      apiEndpoints.push(...endpoints);
    }

    return apiEndpoints;
  }

  private findAllAPICalls(sourceFiles: ScannedFile[]): Reference[] {
    const callSites: Reference[] = [];
    for (const file of sourceFiles) {
      if (!file.content) continue;
      const lines = file.content.split('\n');
      lines.forEach((line, lineIndex) => {
        const apiPaths = this.extractAPIPathsFromLine(line);
        for (const apiPath of apiPaths) {
          callSites.push({
            filePath: file.path,
            line: lineIndex + 1,
            column: line.indexOf(apiPath),
            type: 'usage',
            context: line.trim(),
            apiPath: apiPath,
          });
        }
      });
    }
    return callSites;
  }

  private extractAPIPathsFromLine(line: string): string[] {
    const paths: string[] = [];
    const patterns = [
      /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        // For fetch, it's group 1. For axios, it's group 2.
        const url = match[1] || match[2];
        if (url && (url.startsWith('/api/') || url.startsWith('api/'))) {
          paths.push(url);
        }
      }
    }
    return paths;
  }

  private async analyzeAPIFile(
    apiFile: ScannedFile,
    allCallSites: Reference[]
  ): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    if (!apiFile.content) return endpoints;

    const apiPath = this.extractAPIPath(apiFile);
    const methods = this.extractHTTPMethods(apiFile.content);
    const dynamicSegments = this.extractDynamicSegments(apiPath);

    // Match call sites to this specific API
    const callSites = allCallSites.filter((call) => this.apiPathMatches(call.apiPath, apiPath));

    const isServerAction = this.checkServerAction(apiFile.content);
    const classification = this.classifyAPI(callSites, methods);
    const confidence = this.calculateAPIConfidence(classification, callSites, methods);
    const reasons = this.generateAPIReasons(classification, callSites, methods);

    endpoints.push({
      path: apiPath,
      filePath: apiFile.path,
      methods,
      callSites,
      dynamicSegments,
      classification,
      serverActions: isServerAction,
      confidence,
      reasons,
    });

    return endpoints;
  }

  private apiPathMatches(callPath: string | undefined, apiPath: string): boolean {
    if (!callPath) return false;

    // Normalize paths to remove leading slashes for comparison
    const normalizedCallPath = callPath.startsWith('/') ? callPath.substring(1) : callPath;
    const normalizedApiPath = apiPath.startsWith('/') ? apiPath.substring(1) : apiPath;

    // Create a regex from the API path to handle dynamic segments
    const apiPathRegex = new RegExp('^' + normalizedApiPath.replace(/\[[^\]]+\]/g, '[^/]+') + '$');

    return apiPathRegex.test(normalizedCallPath);
  }

  private isAPIFile(file: ScannedFile): boolean {
    const relativePath = path.relative(this.config.projectRoot, file.path);

    // App Router API routes
    if (this.projectStructure.hasAppDir) {
      if (relativePath.includes('app/') && path.basename(file.path, file.extension) === 'route') {
        return true;
      }
    }

    // Pages Router API routes
    if (this.projectStructure.hasPagesDir) {
      if (relativePath.includes('pages/api/')) {
        return true;
      }
    }

    return false;
  }

  private extractAPIPath(apiFile: ScannedFile): string {
    const relativePath = path.relative(this.config.projectRoot, apiFile.path);
    let apiPath = '';

    if (this.projectStructure.hasAppDir && relativePath.includes('app/')) {
      // App Router: app/api/users/[id]/route.ts -> /api/users/[id]
      const pathParts = relativePath.split('/');
      const apiIndex = pathParts.indexOf('api');
      if (apiIndex !== -1) {
        const routeParts = pathParts.slice(apiIndex);
        // Remove 'route.ts' or 'route.js' from the end
        if (routeParts[routeParts.length - 1].startsWith('route.')) {
          routeParts.pop();
        }
        apiPath = '/' + routeParts.join('/');
      }
    } else if (this.projectStructure.hasPagesDir && relativePath.includes('pages/api/')) {
      // Pages Router: pages/api/users/[id].ts -> /api/users/[id]
      const pathParts = relativePath.split('/');
      const apiIndex = pathParts.indexOf('api');
      if (apiIndex !== -1) {
        const routeParts = pathParts.slice(apiIndex);
        // Remove file extension from the last part
        const lastPart = routeParts[routeParts.length - 1];
        routeParts[routeParts.length - 1] = path.basename(lastPart, path.extname(lastPart));
        apiPath = '/' + routeParts.join('/');
      }
    }

    return apiPath || '/unknown';
  }

  private extractHTTPMethods(content: string): HTTPMethod[] {
    const methods: HTTPMethod[] = [];
    const methodRegexes = {
      GET: /export\s+(async\s+)?function\s+GET\s*\(/,
      POST: /export\s+(async\s+)?function\s+POST\s*\(/,
      PUT: /export\s+(async\s+)?function\s+PUT\s*\(/,
      DELETE: /export\s+(async\s+)?function\s+DELETE\s*\(/,
      PATCH: /export\s+(async\s+)?function\s+PATCH\s*\(/,
      OPTIONS: /export\s+(async\s+)?function\s+OPTIONS\s*\(/,
      HEAD: /export\s+(async\s+)?function\s+HEAD\s*\(/,
    };

    // Check for App Router style exports
    for (const [method, regex] of Object.entries(methodRegexes)) {
      if (regex.test(content)) {
        methods.push(method as HTTPMethod);
      }
    }

    // Check for Pages Router style default export
    if (methods.length === 0) {
      const defaultExportRegex = /export\s+default\s+(async\s+)?function/;
      if (defaultExportRegex.test(content)) {
        // Pages Router can handle multiple methods in req.method
        const methodChecks = {
          GET: /req\.method\s*===?\s*['"`]GET['"`]/,
          POST: /req\.method\s*===?\s*['"`]POST['"`]/,
          PUT: /req\.method\s*===?\s*['"`]PUT['"`]/,
          DELETE: /req\.method\s*===?\s*['"`]DELETE['"`]/,
          PATCH: /req\.method\s*===?\s*['"`]PATCH['"`]/,
        };

        for (const [method, regex] of Object.entries(methodChecks)) {
          if (regex.test(content)) {
            methods.push(method as HTTPMethod);
          }
        }

        // If no specific methods found, assume GET (default)
        if (methods.length === 0) {
          methods.push('GET');
        }
      }
    }

    return methods;
  }

  private extractDynamicSegments(apiPath: string): string[] {
    const segments: string[] = [];
    const matches = apiPath.match(/\[([^\]]+)\]/g);

    if (matches) {
      for (const match of matches) {
        const segment = match.slice(1, -1); // Remove [ and ]
        segments.push(segment);
      }
    }

    return segments;
  }

  private checkServerAction(content: string): boolean {
    // Check for "use server" directive (Next.js 13+ Server Actions)
    return content.includes("'use server'") || content.includes('"use server"');
  }

  private classifyAPI(
    callSites: Reference[],
    _methods: HTTPMethod[]
  ): 'ACTIVE' | 'UNUSED' | 'REDUNDANT' {
    if (callSites.length === 0) {
      return 'UNUSED';
    }

    if (callSites.length > 0) {
      return 'ACTIVE';
    }

    // Could add logic for REDUNDANT classification
    // (e.g., multiple APIs doing the same thing)
    return 'ACTIVE';
  }

  private calculateAPIConfidence(
    classification: 'ACTIVE' | 'UNUSED' | 'REDUNDANT',
    callSites: Reference[],
    methods: HTTPMethod[]
  ): number {
    if (classification === 'ACTIVE' && callSites.length > 0) {
      return Math.min(95, 70 + callSites.length * 5); // Higher confidence with more usage
    }

    if (classification === 'UNUSED') {
      let confidence = 85; // Base confidence for unused APIs

      // Reduce confidence for common API patterns that might be called externally
      if (methods.includes('GET')) {
        confidence -= 10; // GET endpoints might be called by external services
      }

      return confidence;
    }

    return 50; // Medium confidence for other cases
  }

  private generateAPIReasons(
    classification: 'ACTIVE' | 'UNUSED' | 'REDUNDANT',
    callSites: Reference[],
    methods: HTTPMethod[]
  ): string[] {
    const reasons: string[] = [];

    switch (classification) {
      case 'ACTIVE':
        reasons.push(`API is actively used (${callSites.length} call sites found)`);
        reasons.push(`Supports methods: ${methods.join(', ')}`);
        break;

      case 'UNUSED':
        reasons.push('No API call sites found in codebase');
        reasons.push(`Defines methods: ${methods.join(', ')}`);
        reasons.push('Could be called by external services or tests');
        break;

      case 'REDUNDANT':
        reasons.push('Multiple APIs provide similar functionality');
        break;
    }

    return reasons;
  }
}
