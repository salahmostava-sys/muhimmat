/**
 * Shared Tailwind classes for auth-style form fields (Login, password reset, etc.).
 * Centralizes patterns to reduce duplication and Sonar duplication warnings.
 * Input value uses 16px (text-base) for readability per UI guidelines.
 */
export const AUTH_FORM_INPUT_BASE =
  'min-h-[56px] py-4 px-4 text-base md:text-base font-medium leading-normal rounded-xl border-border bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 [&::placeholder]:text-base [&::placeholder]:font-normal [&::placeholder]:opacity-70';

export const AUTH_FORM_LABEL_CLASS = 'block text-[16px] font-semibold text-foreground text-start';
