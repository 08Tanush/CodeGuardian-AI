import { useEffect } from "react";

/**
 * Sets document.title for the current page and restores the app default
 * on unmount, so navigating away (or hitting the browser back button)
 * doesn't leave a stale title from a previous page.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — CodeGuardian AI` : "CodeGuardian AI";
    return () => {
      document.title = previous;
    };
  }, [title]);
}
