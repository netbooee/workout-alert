import { describe, expect, it } from 'vitest';

import { isReviewEmail } from './review-account';

describe('isReviewEmail', () => {
  it('matches the review accounts in any case, with stray spaces', () => {
    expect(isReviewEmail(' Review@Sigamos.cloud ')).toBe(true);
    expect(isReviewEmail('sam.review@sigamos.cloud')).toBe(true);
  });
  it('leaves everyone else on emailed codes', () => {
    expect(isReviewEmail('tony@example.com')).toBe(false);
    expect(isReviewEmail('review@sigamos.cloud.evil.com')).toBe(false);
  });
});
