// Client-side mirror of the key server (Zod) rules, for instant inline feedback.
// The server remains the source of truth and its field errors are shown too.

export type Errors = Record<string, string>;

export const isPhone = (v: string) => {
  const digits = v.replace(/\D/g, '');
  return /^\+?[0-9\s-]{10,18}$/.test(v.trim()) && digits.length >= 10 && digits.length <= 13;
};

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function validateRequestForm(v: {
  title: string; description: string; quantity: string; peopleAffected: string; city: string; area: string;
  addressLine: string; contactPhone: string; category: string; priority: string;
}): Errors {
  const e: Errors = {};
  if (v.title.trim().length < 5) e.title = 'Title must be at least 5 characters.';
  else if (v.title.trim().length > 100) e.title = 'Title must be at most 100 characters.';
  if (!v.category) e.category = 'Choose a category.';
  if (!v.priority) e.priority = 'Choose a priority.';
  if (v.description.trim().length < 10) e.description = 'Describe the need in at least 10 characters.';
  else if (v.description.trim().length > 1000) e.description = 'Description must be at most 1000 characters.';
  const qty = Number(v.quantity);
  if (!Number.isInteger(qty) || qty < 1) e.quantity = 'Quantity must be a whole number, at least 1.';
  const ppl = Number(v.peopleAffected);
  if (!Number.isInteger(ppl) || ppl < 1) e.peopleAffected = 'People affected must be a whole number, at least 1.';
  if (v.city.trim().length < 2) e.city = 'City is required.';
  if (v.area.trim().length < 2) e.area = 'Area is required.';
  if (v.addressLine.trim().length < 3) e.addressLine = 'Add a landmark or street so volunteers can find you.';
  if (!isPhone(v.contactPhone)) e.contactPhone = 'Enter a valid phone number (10-13 digits).';
  return e;
}
