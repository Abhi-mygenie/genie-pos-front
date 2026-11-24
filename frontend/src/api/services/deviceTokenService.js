// Device Token Service — BUG-749
// Registers this device's current Firebase FCM token with the backend on every
// authenticated boot/reload (incl. login-as-restaurant) so the backend can push
// to it. Non-blocking by design — callers fire-and-forget; errors are swallowed.
import api from '../axios';
import { API_ENDPOINTS } from '../constants';

/**
 * Register the device FCM token with the backend.
 * POST /api/v1/vendoremployee/device-token  { fcm_token }
 * Idempotent, last-write-wins, no client dedupe (backend D5). Bearer auth is
 * attached automatically by the axios request interceptor.
 *
 * @param {string} fcmToken - current Firebase device token
 * @returns {Promise<string|null>} stored token echoed by backend, or null
 */
export const registerDeviceToken = async (fcmToken) => {
  if (!fcmToken) return null;
  try {
    const res = await api.post(API_ENDPOINTS.DEVICE_TOKEN, { fcm_token: fcmToken });
    return res.data?.fcm_token ?? null;
  } catch (err) {
    console.warn('[BUG-749] device-token register failed:', err?.readableMessage || err?.message);
    return null;
  }
};
