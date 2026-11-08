const path = require('node:path');
const Sequencer = require('@jest/test-sequencer').default;

// Seconds each file took in CI (Jest prints the files over 5 s). Every other file counts as 1.
// shortcut: hand-copied from a CI run, update it when a file joins or leaves this list.
const SECONDS = {
  '__tests__/universal-delivery.test.ts': 50,
  '__tests__/raid-screen.test.tsx': 45,
  '__tests__/dashboard-screen.test.tsx': 21,
  '__tests__/study-session-screen.test.tsx': 19,
  '__tests__/character-screen.test.tsx': 15,
  '__tests__/guild-screen.test.tsx': 8,
  '__tests__/market-screen.test.tsx': 8,
};

const seconds = (test) =>
  SECONDS[path.relative(test.context.config.rootDir, test.path).split(path.sep).join('/')] ?? 1;

/** Splits `--shard` by known duration instead of by path hash: each file, longest first, goes to the lightest shard. */
class DurationSequencer extends Sequencer {
  shard(tests, { shardIndex, shardCount }) {
    const shards = Array.from({ length: shardCount }, () => ({ load: 0, tests: [] }));
    const ordered = [...tests].sort((a, b) => seconds(b) - seconds(a) || a.path.localeCompare(b.path));
    for (const test of ordered) {
      const lightest = shards.reduce((min, shard) => (shard.load < min.load ? shard : min));
      lightest.load += seconds(test);
      lightest.tests.push(test);
    }
    return shards[shardIndex - 1].tests;
  }
}

module.exports = DurationSequencer;
