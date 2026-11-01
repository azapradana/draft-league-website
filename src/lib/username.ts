export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,20}$/;
export const USERNAME_RULES_MESSAGE = "3 to 20 characters: letters, numbers, _ . -";
export const USERNAME_INVALID_ERROR = `Username must be ${USERNAME_RULES_MESSAGE}`;
export const USERNAME_TAKEN_ERROR = "That username is taken.";

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function usernameKey(value: string): string {
  return value.toLowerCase();
}
