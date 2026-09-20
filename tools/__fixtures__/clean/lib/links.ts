// The one file allowed to spell a route out: `lib/simulation/links.ts`. The
// verifier exempts it by path, so the clean fixture mirrors that path.
export const links = {
  billing: (): string => '/account',
};
