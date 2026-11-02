import { fetchWithAuth, apiUrl } from './api';

export interface ConflictingTask {
  id: string;
  taskName: string;
  startDate: string | null;
  dueDate: string;
  priority: string;
  status: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  progressPct?: number;
  isCurrentProject?: boolean;
}

export interface DailyBreakdownItem {
  date: string;
  taskCount: number;
  tasks: Array<{
    id: string;
    taskName: string;
    projectName: string;
    projectCode: string;
    priority: string;
    status: string;
  }>;
}

export interface WorkloadData {
  assignee: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  dateRange: {
    startDate: string | null;
    dueDate: string | null;
  };
  conflictCount: number;
  peakConcurrency: number;
  workloadLevel: 'optimal' | 'moderate' | 'heavy' | 'critical';
  statusLabel: string;
  badgeColor: 'green' | 'amber' | 'orange' | 'red';
  advisory: string;
  canProceed: boolean;
  conflictingTasks: ConflictingTask[];
  dailyBreakdown: DailyBreakdownItem[];
}

export async function fetchEngineerWorkload(
  assigneeId: string,
  startDate?: string,
  dueDate?: string,
  excludeTaskId?: string,
  projectId?: string
): Promise<WorkloadData | null> {
  if (!assigneeId) return null;

  try {
    const params = new URLSearchParams({ assignee_id: assigneeId });
    if (startDate) params.set('start_date', startDate);
    if (dueDate) params.set('due_date', dueDate);
    if (excludeTaskId) params.set('exclude_task_id', excludeTaskId);
    if (projectId) params.set('project_id', projectId);

    const res = await fetchWithAuth(apiUrl(`tasks/workload?${params.toString()}`));
    if (!res.ok) return null;

    const body = await res.json();
    if (body.success && body.data) {
      return body.data as WorkloadData;
    }
    return null;
  } catch (err) {
    console.error('[fetchEngineerWorkload] Failed to fetch:', err);
    return null;
  }
}
