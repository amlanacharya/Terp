# Testing Guide

## Test Framework

We use **Vitest** as our test framework with the following setup:
- **Unit Tests**: Component and service tests
- **Integration Tests**: API endpoint tests
- **Coverage**: v8 coverage provider

## Running Tests

```bash
# Run all tests
npm test

# Run tests in UI mode
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests once (CI mode)
npm run test:run
```

## Test Structure

```
travelerp-lite/
├── src/
│   ├── components/
│   │   └── **/__tests__/       # Component tests
│   └── test/
│       ├── setup.ts              # Test setup and mocks
│       ├── mocks/                # Mock utilities
│       └── integration/          # Integration tests
└── server/
    └── src/
        └── **/*.test.ts          # Backend tests
```

## Writing Tests

### Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Service Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyService } from './MyService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should perform action', () => {
    const result = service.doSomething();
    expect(result).toBe(true);
  });
});
```

## Test Coverage

Current coverage targets:
- Overall: 80%
- Components: 85%
- Services: 90%
- API Routes: 85%

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Release builds

## Debugging Tests

```bash
# Run with UI for debugging
npm run test:ui

# Run specific test file
npm test -- MyComponent.test.tsx

# Run with verbose output
npm test -- --reporter=verbose
```
