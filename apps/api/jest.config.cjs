/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*(src|test)/.*\\.(spec|test)\\.ts$",
  transform: { "^.+\\.(t|j)s$": "ts-jest" },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
  testTimeout: 60000,
  moduleNameMapper: {
    "^@gharsetu/shared$": "<rootDir>/../../packages/shared/dist/index.cjs",
  },
};
