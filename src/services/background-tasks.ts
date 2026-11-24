import { AsyncLocalStorage } from "node:async_hooks";

type BackgroundScheduler = (task: Promise<unknown>) => void | undefined;
const schedulerStorage = new AsyncLocalStorage<BackgroundScheduler>();

export function withBackgroundScheduler<T>(
  scheduler: BackgroundScheduler,
  action: () => Promise<T>,
): Promise<T> {
  return schedulerStorage.run(scheduler, action);
}

export function scheduleBackgroundTask(task: Promise<unknown>): void {
  const scheduler = schedulerStorage.getStore();
  if (scheduler) {
    scheduler(task);
    return;
  }
  void task.catch((error: unknown) =>
    console.error("Background task failed:", error),
  );
}
