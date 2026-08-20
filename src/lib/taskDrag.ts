const TASK_DRAG_TYPE = 'application/x-projectzentrale-task';

export interface TaskDragPayload { projectId: string; taskId: string; }

export function writeTaskDrag(dataTransfer: DataTransfer, payload: TaskDragPayload) {
  dataTransfer.setData(TASK_DRAG_TYPE, JSON.stringify(payload));
  dataTransfer.setData('text/plain', payload.taskId);
}

export function readTaskDrag(dataTransfer: DataTransfer): TaskDragPayload | null {
  try {
    const raw = dataTransfer.getData(TASK_DRAG_TYPE);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Partial<TaskDragPayload>;
    return payload.projectId && payload.taskId ? { projectId: payload.projectId, taskId: payload.taskId } : null;
  } catch { return null; }
}

export function hasTaskDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(TASK_DRAG_TYPE);
}
