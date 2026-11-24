// BUG-747 — soundManager autoplay-unlock unit tests
import soundManager from '../../utils/soundManager';

const mkAudio = (playImpl) =>
  jest.fn().mockImplementation(() => ({
    play: playImpl,
    pause: jest.fn(),
    addEventListener: jest.fn(),
    muted: false,
    currentTime: 0,
    cloneNode() { return this; },
  }));

describe('soundManager autoplay unlock (BUG-747)', () => {
  afterEach(() => { jest.clearAllMocks(); });

  test('getState().isUnlocked is false by default', () => {
    expect(soundManager.getState().isUnlocked).toBe(false);
  });

  test('unlock() resolves true and flips isUnlocked when play resolves', async () => {
    global.Audio = mkAudio(jest.fn().mockResolvedValue(undefined));
    const ok = await soundManager.unlock();
    expect(ok).toBe(true);
    expect(soundManager.getState().isUnlocked).toBe(true);
  });

  test('setBlockedHandler fires when a play is blocked by autoplay policy', async () => {
    global.Audio = mkAudio(jest.fn().mockRejectedValue(new Error('blocked')));
    const spy = jest.fn();
    soundManager.setBlockedHandler(spy);
    soundManager.play('new_order');
    await Promise.resolve();
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
    soundManager.setBlockedHandler(null);
  });
});
