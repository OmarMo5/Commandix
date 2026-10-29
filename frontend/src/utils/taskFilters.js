// Board filter model shared by the filter bar and the page that applies it.

export const EMPTY_FILTERS = {
  search: '', priority: '', department_id: '', assignee_id: '', due: '', mine: false, assigned_to_me: false,
};

/** Active filters as plain query params (drops empties / false). */
export function filtersToParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== false && v != null)
      .map(([k, v]) => [k, v === true ? 1 : v])
  );
}

export function activeFilterCount(filters) {
  return Object.keys(filtersToParams(filters)).length;
}

/**
 * Sidebar shortcuts: /tasks?view=<name> opens the board with these filters applied.
 * (They are derived from the URL, so the page never has to sync state into itself.)
 */
export const VIEW_PRESETS = {
  assigned:  { assigned_to_me: true },
  attention: { assigned_to_me: true, due: 'attention' },   // overdue or due today, not finished
};
