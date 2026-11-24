// BUG-749 — deviceTokenService unit tests
import { registerDeviceToken } from '../../api/services/deviceTokenService';
import api from '../../api/axios';
import { API_ENDPOINTS } from '../../api/constants';

jest.mock('../../api/axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

describe('registerDeviceToken (BUG-749)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('POSTs {fcm_token} to DEVICE_TOKEN and returns the stored token', async () => {
    api.post.mockResolvedValue({ data: { status: 'ok', fcm_token: 'stored-abc' } });
    const out = await registerDeviceToken('tok-123');
    expect(api.post).toHaveBeenCalledWith(API_ENDPOINTS.DEVICE_TOKEN, { fcm_token: 'tok-123' });
    expect(out).toBe('stored-abc');
  });

  test('null/empty token → makes no call and returns null', async () => {
    const out = await registerDeviceToken(null);
    expect(api.post).not.toHaveBeenCalled();
    expect(out).toBeNull();
  });

  test('POST failure is swallowed → returns null (non-blocking)', async () => {
    api.post.mockRejectedValue(new Error('network'));
    const out = await registerDeviceToken('tok-xyz');
    expect(out).toBeNull();
  });
});
