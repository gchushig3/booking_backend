import base from '../jest.config.mjs';
export default {
  ...base,
  rootDir: '..',
  testMatch: ['<rootDir>/test/integration/**/*.integration-spec.ts'],
  testTimeout: 30000,
};
