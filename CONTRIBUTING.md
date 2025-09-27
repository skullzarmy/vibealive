# Contributing to VibeAlive

Thank you for your interest in contributing to VibeAlive! This document provides guidelines for contributing to the project and helps ensure a smooth collaboration process.

## Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Node.js 16.0.0 or higher
- npm (comes with Node.js)
- Git

### Development Setup

1. **Fork and Clone the Repository**

   ```bash
   git clone https://github.com/your-username/vibealive.git
   cd vibealive
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Build the Project**

   ```bash
   npm run build
   ```

4. **Run Tests**

   ```bash
   npm test
   ```

5. **Run Linting**
   ```bash
   npm run lint
   npm run format:check
   ```

### Project Structure

```
vibealive/
├── src/                    # Source code
│   ├── analyzers/         # Analysis logic
│   ├── config/            # Configuration handling
│   ├── generators/        # Report generators
│   ├── mcp/              # MCP server implementation
│   └── scanners/         # File scanning utilities
├── docs/                  # Documentation
├── examples/              # Usage examples and configurations
├── __tests__/            # Test files
└── dist/                 # Built output (generated)
```

## Development Workflow

### 1. Choose Your Contribution

- **Bug Fix**: Address existing issues
- **Feature**: Add new functionality
- **Documentation**: Improve or add documentation
- **Examples**: Add integration examples or CI/CD configurations

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 3. Make Changes

Follow these guidelines when making changes:

#### Code Style

- Use TypeScript for all source code
- Follow existing code formatting (Prettier configuration)
- Use ESLint rules defined in `.eslintrc.js`
- Write clear, descriptive variable and function names

#### Testing

- Add tests for new functionality
- Ensure existing tests pass: `npm test`
- Aim for good test coverage
- Use descriptive test names that explain the behavior being tested

#### Documentation

- Update relevant documentation for your changes
- Add JSDoc comments for public APIs
- Include examples in your documentation when helpful

### 4. Commit Your Changes

Use clear, descriptive commit messages following this format:

```
type(scope): brief description

Longer description if needed, explaining:
- What changed
- Why it changed
- Any breaking changes or migration notes
```

Examples:

```bash
git commit -m "feat(analyzer): add support for App Router patterns"
git commit -m "fix(mcp): resolve server startup race condition"
git commit -m "docs(examples): add Azure DevOps pipeline configuration"
```

### 5. Push and Create Pull Request

```bash
git push origin your-branch-name
```

Create a pull request with:

- **Clear title** describing the change
- **Detailed description** explaining the problem and solution
- **Reference to related issues** (if applicable)
- **Screenshots** for UI changes
- **Breaking changes** clearly marked

## Pull Request Guidelines

### PR Requirements

- [ ] Code follows project style guidelines
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation is updated
- [ ] Commit messages are clear and descriptive
- [ ] PR description explains the change and its impact

### Review Process

1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: Changes are tested in various environments
4. **Documentation**: Ensure documentation is accurate and complete

### What to Expect

- **Response Time**: We aim to respond to PRs within 48 hours
- **Feedback**: Constructive feedback to help improve the contribution
- **Iteration**: You may be asked to make changes based on review feedback
- **Merge**: Approved PRs are merged by maintainers

## Types of Contributions

### Bug Reports

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)
- Relevant code snippets or logs

### Feature Requests

For new features, please:

- Describe the use case and problem it solves
- Provide examples of how it would be used
- Consider backward compatibility
- Discuss implementation approach if you have ideas

### Code Contributions

Areas where contributions are especially welcome:

- **Framework Support**: Add support for new frameworks
- **Analysis Improvements**: Enhance detection algorithms
- **Performance**: Optimize analysis speed and memory usage
- **CI/CD Integration**: Add new platform examples
- **Documentation**: Improve guides and examples

### Documentation Contributions

Help improve:

- **API Documentation**: JSDoc comments and type definitions
- **User Guides**: Step-by-step tutorials and best practices
- **Examples**: Real-world integration patterns
- **Troubleshooting**: Common issues and solutions

## Development Commands

```bash
# Development
npm run dev          # Watch mode compilation
npm run build        # Compile TypeScript
npm run test         # Run all tests
npm run test:watch   # Watch mode testing
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # Check linting
npm run lint:fix     # Fix linting issues
npm run format       # Format code
npm run format:check # Check formatting

# Specialized Testing
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:mcp         # MCP server tests
npm run test:cli         # CLI tests
```

## Configuration Examples

When adding new examples or configurations, reference existing patterns:

- **CI/CD Examples**: See [examples/ci-cd/](./examples/ci-cd/)
- **Configuration Files**: See [examples/vibealive.config.js](./examples/vibealive.config.js)
- **Integration Patterns**: See [docs/build-integration.md](./docs/build-integration.md)

## Best Practices

### Code Quality

- Write self-documenting code with clear names
- Add comments for complex logic
- Handle errors gracefully
- Use TypeScript types effectively
- Follow existing patterns in the codebase

### Testing

- Test both success and error cases
- Use meaningful test descriptions
- Mock external dependencies appropriately
- Maintain good test coverage
- Test edge cases and boundary conditions

### Performance

- Consider memory usage in large projects
- Optimize file scanning patterns
- Cache results when appropriate
- Use streaming for large data sets
- Profile performance-critical code

### Compatibility

- Support Node.js 16.0.0+
- Test with different Next.js versions
- Ensure cross-platform compatibility
- Consider backward compatibility for API changes

## Environment-Specific Guidelines

### CI/CD Integration

When adding CI/CD examples, ensure they:

- Use appropriate `--ci` flags for machine-readable output
- Set reasonable `--max-issues` thresholds
- Include artifact upload for debugging
- Handle different environment stages (dev/staging/prod)
- Follow security best practices

### Configuration Files

- Use the established configuration schema
- Provide clear comments explaining options
- Include examples for common use cases
- Document environment variable support
- Test configurations in real projects

## Getting Help

If you need help with your contribution:

1. **Check Documentation**: Review [docs/](./docs/) directory
2. **Search Issues**: Look for similar problems or questions
3. **Ask Questions**: Open a discussion or issue for clarification
4. **Join Community**: Participate in project discussions

## Recognition

Contributors are recognized in:

- Project README acknowledgments
- Release notes for significant contributions
- GitHub contributor graphs and statistics

Thank you for contributing to VibeAlive! Your efforts help make this tool better for the entire Next.js community.
