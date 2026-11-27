export const PLANS = ['hourly', 'daily', 'monthly', 'yearly'];

export const PLAN_UNIT = { hourly: 'hour', daily: 'day', monthly: 'month', yearly: 'year' };

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'];

export const STATUSES = ['available', 'unavailable', 'dnd', 'brb', 'away', 'offline'];

// Statuses in which a user can still be hired.
export const HIREABLE_STATUSES = ['available', 'brb', 'away'];

export const BOOKING_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const CATEGORIES = [
  { name: 'Driver', skills: ['Driver', 'Car Driver', 'Truck Driver', 'Bike Rider'] },
  { name: 'Home Services', skills: ['Carpenter', 'Painter', 'Plumber', 'Electrician', 'Mason', 'AC Technician', 'Cleaner', 'Cook'] },
  { name: 'Technology', skills: ['Software Engineer', 'Web Developer', 'Mobile App Developer', 'Data Analyst', 'UI/UX Designer'] },
  { name: 'Healthcare', skills: ['Doctor', 'Nurse', 'Physiotherapist', 'Caretaker'] },
  { name: 'Education', skills: ['Teacher', 'Tutor', 'Music Teacher', 'Yoga Trainer'] },
  { name: 'Creative', skills: ['Photographer', 'Videographer', 'Video Editor', 'Graphic Designer', 'Makeup Artist'] },
  { name: 'Business', skills: ['Accountant', 'Lawyer', 'Consultant', 'Translator'] },
  { name: 'Other', skills: ['Security Guard', 'Gardener', 'Delivery Partner', 'Event Helper'] },
];
