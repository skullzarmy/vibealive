// src/mcp/schema.ts

export const mcpSchema = {
  name: 'vibealive',
  description: 'A tool for analyzing Next.js projects to find unused code.',
  methods: [
    {
      name: 'mcp.discover',
      description: 'Provides a machine-readable description of all available methods.',
      params: [],
      returns: { type: 'object', description: 'The server capabilities schema.' },
    },
    {
      name: 'mcp.status',
      description: 'Checks the general status of the MCP server or a specific analysis job.',
      params: [
        {
          name: 'jobId',
          type: 'string',
          required: false,
          description: 'If provided, checks the status of a specific job.',
        },
      ],
      returns: { type: 'object', description: 'The status of the server or job.' },
    },
    {
      name: 'mcp.help',
      description: 'Provides detailed, human-readable help for a specific method.',
      params: [
        {
          name: 'method',
          type: 'string',
          required: true,
          description: 'The method to get help for.',
        },
      ],
      returns: { type: 'string', description: 'Detailed help text for the method.' },
    },
    {
      name: 'mcp.analyze',
      description: 'Initiates a full, asynchronous analysis of a Next.js project.',
      params: [
        { name: 'projectPath', type: 'string', required: true },
        { name: 'options', type: 'object', required: false },
      ],
      returns: { type: 'object', description: 'A job object with an ID and status.' },
    },
    {
      name: 'mcp.getReport',
      description: 'Retrieves the full JSON analysis report for a completed job.',
      params: [{ name: 'jobId', type: 'string', required: true }],
      returns: { type: 'object', description: 'The full analysis report.' },
    },
    {
      name: 'mcp.getFileDetails',
      description: 'Retrieves the detailed analysis for a single file.',
      params: [
        { name: 'projectPath', type: 'string', required: true },
        { name: 'filePath', type: 'string', required: true },
      ],
      returns: { type: 'object', description: 'The FileAnalysis object for the file.' },
    },
    {
      name: 'mcp.getDependencyInfo',
      description: 'Retrieves the import/export relationships for a specific file.',
      params: [
        { name: 'projectPath', type: 'string', required: true },
        { name: 'filePath', type: 'string', required: true },
      ],
      returns: { type: 'object', description: 'The dependency information for the file.' },
    },
  ],
};
