module.exports = {
  roots: ["src"],
  testMatch: ["**/?(*.)+(spec).+(ts)"],
  transform: {
    "^.+\\.(ts)$": "ts-jest",
  },
  collectCoverage: true,
};
