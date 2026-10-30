import base from '../jest.config.mjs';
export default {
  ...base,
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
};
