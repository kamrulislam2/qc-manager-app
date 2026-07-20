import { TodoItem } from "@/types";

/**
 * Shared "recently active tasks" ordering for the Superadmin Todo panel.
 *
 * Most recently touched task first — last_activity_at is bumped by the DB
 * trigger `todos_set_last_activity` on every update and defaults to NOW()
 * on insert, so new tasks, status changes (Working/Completed), edits and
 * comment updates all float to the top. Falls back to created_at for rows
 * fetched before the column existed in a stale cache.
 *
 * ALL Todo ordering (initial fetch, optimistic updates, realtime events)
 * must go through this helper — do not duplicate sorting logic.
 */
export const sortTodosByActivity = (todos: TodoItem[]): TodoItem[] => {
  return [...todos].sort((a, b) => {
    const timeA = new Date(a.last_activity_at || a.created_at || 0).getTime();
    const timeB = new Date(b.last_activity_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });
};
