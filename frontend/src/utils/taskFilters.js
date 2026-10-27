// Board filter model shared by the filter bar and the page that applies it.

export const EMPTY_FILTERS = {
  search: '', priority: '', department_id: '', assignee_id: '', due: '', mine: false,
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
