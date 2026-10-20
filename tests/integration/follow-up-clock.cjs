const RealDate = Date;
const frozen = process.env.CI_FOLLOW_UP_CLOCK;
if (!frozen || !/^\d{4}-\d{2}-\d{2}T/.test(frozen)) throw new Error("Test-only clock required");
const fixed = new RealDate(frozen).getTime();
global.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [fixed])); }
  static now() { return fixed; }
};
