// What can be reported, and the reasons offered for each. The `value` is sent to the API.
const REPORT_TARGETS = {
  blog: 'blog post',
  comment: 'comment',
  user: 'user',
};

const SPAM = { value: 'spam', label: 'Spam or misleading' };
const HARASSMENT = { value: 'harassment', label: 'Harassment or hate' };
const INAPPROPRIATE = { value: 'inappropriate', label: 'Inappropriate or graphic content' };
const OTHER = { value: 'other', label: 'Something else' };

const REPORT_REASONS = {
  blog: [SPAM, HARASSMENT, INAPPROPRIATE, { value: 'copyright', label: 'Plagiarism or copyright' }, OTHER],
  comment: [SPAM, HARASSMENT, INAPPROPRIATE, OTHER],
  user: [SPAM, HARASSMENT, { value: 'impersonation', label: 'Pretending to be someone else' }, INAPPROPRIATE, OTHER],
};

export { REPORT_TARGETS, REPORT_REASONS };
