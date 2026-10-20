import { clsx, type ClassValue } from 'clsx';

/** Ghép className có điều kiện. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
