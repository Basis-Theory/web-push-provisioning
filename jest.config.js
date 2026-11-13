const common = {
  automock: false,
  coveragePathIgnorePatterns: ['test', 'dist'],
  transform: { '^.+\\.(t|j)sx?$': ['@swc/jest'] },
  testPathIgnorePatterns: ['cypress', '<rootDir>/e2e/'],
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  moduleNameMapper: {
    '~src/(.*)': '<rootDir>/src/$1',
  },
};

module.exports = {
  projects: [
    {
      ...common,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
    },
  ],
};
