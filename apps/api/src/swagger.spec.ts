import { swaggerAutoAuthorize } from './swagger.js';

type Interceptor = typeof swaggerAutoAuthorize;

describe('swaggerAutoAuthorize', () => {
  const authorize = vi.fn();
  // The function is serialized into the Swagger UI page, so test the serialized version.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- recreates what Swagger UI loads
  const serialized = new Function(`return ${swaggerAutoAuthorize.toString()}`)() as Interceptor;

  beforeEach(() => {
    authorize.mockReset();
    (globalThis as { ui?: unknown }).ui = { authActions: { authorize } };
  });

  afterAll(() => {
    delete (globalThis as { ui?: unknown }).ui;
  });

  it('applies the token from sign-in responses', () => {
    const response = {
      url: 'http://127.0.0.1:3001/api/v1/dev/sign-in',
      status: 200,
      body: { accessToken: 'abc' },
    };
    expect(serialized(response)).toBe(response);
    expect(authorize).toHaveBeenCalledWith({
      bearer: {
        name: 'bearer',
        schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        value: 'abc',
      },
    });
  });

  it('uses the first demo user and parses text bodies', () => {
    serialized({
      url: '/api/v1/dev/demo',
      status: 200,
      text: '{"users":[{"accessToken":"anna"}]}',
    });
    serialized({ url: '/api/v1/auth/otp/verify?x=1', status: 200, body: { accessToken: 'otp' } });
    expect(
      authorize.mock.calls.map(([auth]) => (auth as { bearer: { value: string } }).bearer.value),
    ).toEqual(['anna', 'otp']);
  });

  it('ignores other endpoints, failures and broken bodies', () => {
    serialized({ url: '/api/v1/me', status: 200, body: { accessToken: 'nope' } });
    serialized({ url: '/api/v1/auth/otp/verify', status: 401, body: { code: 'OTP_INVALID' } });
    expect(() =>
      serialized({ url: '/api/v1/auth/refresh', status: 200, text: '{not json' }),
    ).not.toThrow();
    expect(authorize).not.toHaveBeenCalled();
  });
});
