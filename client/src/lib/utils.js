import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard Shadcn cn() helper function for combining conditional class names.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
