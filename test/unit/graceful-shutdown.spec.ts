import { ApplicationShutdownCoordinator } from '../../server/common/lifecycle/application-shutdown.coordinator';

describe('production graceful shutdown gate', () => {
  it('rejects new work and waits for active work with a bound', async () => {
    const coordinator = new ApplicationShutdownCoordinator(25);
    expect(coordinator.beginWork()).toBe(true);
    coordinator.beginShutdown();

    expect(coordinator.beginWork()).toBe(false);
    const drain = coordinator.waitForDrain();
    coordinator.endWork();

    await expect(drain).resolves.toEqual({ drained: true });
  });
});
