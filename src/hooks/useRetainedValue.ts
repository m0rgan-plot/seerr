import { useRef } from 'react';

/**
 * Keeps the last value that was actually set.
 *
 * Modals here are held open by their subject: closing one clears that subject, but the
 * leave transition keeps the modal on screen for another moment. Reading the cleared
 * value during those milliseconds is what makes a closing dialog blank its own title.
 * Retaining the previous one lets it fade out saying what it said.
 */
export const useRetainedValue = <T>(value: T | undefined): T | undefined => {
  const retained = useRef(value);

  if (value !== undefined) {
    retained.current = value;
  }

  return value ?? retained.current;
};

export default useRetainedValue;
