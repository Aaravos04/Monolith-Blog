// The fields a search can look in. The `value` is sent to the API as `by`.
const SEARCH_FIELDS = [
  { value: 'title', label: 'Title' },
  { value: 'content', label: 'Content' },
  { value: 'author', label: 'Author' },
];

const DEFAULT_SEARCH_FIELD = 'title';

const isSearchField = (value) => SEARCH_FIELDS.some((field) => field.value === value);

export { SEARCH_FIELDS, DEFAULT_SEARCH_FIELD, isSearchField };
