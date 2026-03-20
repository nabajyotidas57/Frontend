// jest.config.cjs
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest",
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(png|jpg|jpeg|gif|svg)$": "<rootDir>/src/__mocks__/fileMock.js",
    "^../assets/hdfcbanklogo\\.png$": "<rootDir>/src/__mocks__/fileMock.js",
  },
  moduleFileExtensions: ["js", "jsx"],
  globals: {
    "import.meta": {
      env: {
        VITE_API_BASE: "http://localhost",
      },
    },
  },
};