import axios from 'axios';
import {
  attachBearerToken,
  configureBackendHttpClient,
  configureHttpAuth,
  shouldNotifyUnauthorized,
} from '../../client/src/api/http';

describe('centralized client HTTP auth', () => {
  it('attaches only a real access token and preserves cookie credentials', () => {
    expect(
      attachBearerToken({ withCredentials: true }, 'real-access-token'),
    ).toMatchObject({
      withCredentials: true,
      headers: { Authorization: 'Bearer real-access-token' },
    });
    expect(attachBearerToken({ withCredentials: true }, null)).toEqual({
      withCredentials: true,
    });
    expect(attachBearerToken({ withCredentials: true }, 'mock_token')).toEqual({
      withCredentials: true,
    });
  });

  it('emits one anonymous transition for a 401 request', () => {
    const requestConfig = {};

    expect(shouldNotifyUnauthorized(requestConfig)).toBe(true);
    expect(shouldNotifyUnauthorized(requestConfig)).toBe(false);
  });

  it('maps an actual client 401 response to the configured auth callback', async () => {
    const onUnauthorized = jest.fn();
    const client = axios.create({
      adapter: async (config) =>
        Promise.reject({ response: { status: 401 }, config }),
    });
    configureBackendHttpClient(client);
    configureHttpAuth({ onUnauthorized });

    await expect(client.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    configureHttpAuth({});
  });
});
