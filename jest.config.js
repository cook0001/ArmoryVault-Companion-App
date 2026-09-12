module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Override project tsconfig for tests only
        types: ['jest'],
        moduleResolution: 'node',
        esModuleInterop: true,
      },
      diagnostics: {
        // Ignore TS errors from test files — Jest globals are injected at runtime
        ignoreDiagnostics: [2304, 2582, 2593],
      },
    }],
  },
};
