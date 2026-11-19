import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { runScheduledBackupIfDue } from "./sync";

export const BACKUP_TASK_NAME = "nextill-daily-backup";

if (!TaskManager.isTaskDefined(BACKUP_TASK_NAME)) {
  TaskManager.defineTask(BACKUP_TASK_NAME, async () => {
    try {
      await runScheduledBackupIfDue();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error("Background shop backup failed.", error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackupTask() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (await TaskManager.isTaskRegisteredAsync(BACKUP_TASK_NAME)) return true;
  await BackgroundTask.registerTaskAsync(BACKUP_TASK_NAME, { minimumInterval: 60 });
  return true;
}
