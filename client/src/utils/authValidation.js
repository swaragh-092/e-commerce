const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPasswordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const validateEmail = (email) => {
  const value = String(email || '').trim();
  if (!value) return 'Email is required';
  if (!emailPattern.test(value)) return 'Enter a valid email address';
  return '';
};

export const validatePassword = (password) => {
  const value = String(password || '');
  if (!value) return 'Password is required';
  if (!strongPasswordPattern.test(value)) {
    return 'Use at least 8 characters, 1 uppercase letter, and 1 number';
  }
  return '';
};

export const validateRequired = (value, label) => {
  if (!String(value || '').trim()) {
    return `${label} is required`;
  }
  return '';
};
