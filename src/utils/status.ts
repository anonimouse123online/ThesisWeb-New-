export type StatusVariant =
  | 'completed'
  | 'ongoing'
  | 'planning'
  | 'pending'
  | 'delayed'
  | 'neutral';

export function getStatusVariant(status?: string): StatusVariant {
  if (!status) return 'neutral';
  const s = status.toLowerCase().trim();

  // Completed / Resolved / Active / Available / In Stock
  if (
    s === 'completed' ||
    s === 'resolved' ||
    s === 'done' ||
    s === 'approved' ||
    s === 'in stock' ||
    s === 'instock' ||
    s === 'available' ||
    s === 'active' ||
    s === 'operational'
  ) {
    return 'completed';
  }

  // Ongoing / In Progress / Open
  if (
    s === 'ongoing' ||
    s === 'in progress' ||
    s === 'in-progress' ||
    s === 'inprogress' ||
    s === 'open'
  ) {
    return 'ongoing';
  }

  // Planning / In Review / On Track
  if (
    s === 'planning' ||
    s === 'in review' ||
    s === 'inreview' ||
    s === 'on track' ||
    s === 'ontrack'
  ) {
    return 'planning';
  }

  // Pending / Ready to Join
  if (
    s === 'pending' ||
    s === 'ready to join' ||
    s === 'ready' ||
    s === 'unassigned'
  ) {
    return 'pending';
  }

  // Delayed / Late / At Risk / Low Stock / Low Availability / Busy / Blocked
  if (
    s === 'delayed' ||
    s === 'late' ||
    s === 'at risk' ||
    s === 'atrisk' ||
    s === 'low stock' ||
    s === 'lowstock' ||
    s === 'low availability' ||
    s === 'busy' ||
    s === 'blocked' ||
    s === 'critical'
  ) {
    return 'delayed';
  }

  return 'neutral';
}

