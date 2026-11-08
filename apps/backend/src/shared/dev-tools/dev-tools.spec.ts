import { isDevToolsEmail } from './dev-tools';

describe('isDevToolsEmail', () => {
  it.each([
    [' Dev@Ex.com , b@ex.com', 'dev@ex.com', true],
    [' Dev@Ex.com , b@ex.com', ' B@EX.com ', true],
    [' Dev@Ex.com , b@ex.com', 'devx@ex.com', false],
    ['', 'dev@ex.com', false],
    [',', 'dev@ex.com', false],
    [',', '', false],
    [undefined, 'dev@ex.com', false],
  ])('DEV_TOOLS_EMAILS=%j and e-mail %j is %s', (list, email, expected) => {
    expect(isDevToolsEmail(email, list)).toBe(expected);
  });
});
