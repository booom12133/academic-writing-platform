import { ApplicationShutdownCoordinator } from './application-shutdown.coordinator';

describe('ApplicationShutdownCoordinator', () => {
  it('rejects new work after shutdown begins and drains active work', async () => {
    const coordinator = new ApplicationShutdownCoordinator(50);
    expect(coordinator.beginWork()).toBe(true);
    coordinator.beginShutdown();
    expect(coordinator.beginWork()).toBe(false);

    const draining = coordinator.waitForDrain();
    coordinator.endWork();
    await expect(draining).resolves.toEqual({ drained: true });
  });

  it('returns a bounded timeout when work does not finish', async () => {
    const coordinator = new ApplicationShutdownCoordinator(5);
    expect(coordinator.beginWork()).toBe(true);
    coordinator.beginShutdown();

    await expect(coordinator.waitForDrain()).resolves.toEqual({
      drained: false,
    });
    coordinator.endWork();
  });
});
