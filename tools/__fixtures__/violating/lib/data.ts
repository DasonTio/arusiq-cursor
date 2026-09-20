// The data layer spelling a route out by hand instead of calling links.ts —
// the habit that produced the `/approve?request=` dead end. Under `lib/`
// because that is the scope `href-outside-links` guards.
export const payAction = { labelKey: 'billing.pay', href: '/account' };
