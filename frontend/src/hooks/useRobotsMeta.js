import { useEffect } from "react";

/**
 * Sets the page's <meta name="robots"> and <link rel="canonical"> tags for
 * the current route, restoring the previous values on unmount. Dashboard
 * and Report pages pass noindex=true since they show a specific user's
 * private analysis results (keyed by an unguessable-but-not-secret upload
 * id) - these shouldn't be crawled/indexed even though they're publicly
 * reachable if someone has the exact link, matching robots.txt's
 * Disallow rules for the same paths.
 */
export default function useRobotsMeta(noindex = false) {
  useEffect(() => {
    let robotsTag = document.querySelector('meta[name="robots"]');
    const createdRobotsTag = !robotsTag;
    if (!robotsTag) {
      robotsTag = document.createElement("meta");
      robotsTag.setAttribute("name", "robots");
      document.head.appendChild(robotsTag);
    }
    const previousRobots = robotsTag.getAttribute("content");
    robotsTag.setAttribute("content", noindex ? "noindex, nofollow" : "index, follow");

    let canonicalTag = document.querySelector('link[rel="canonical"]');
    const createdCanonicalTag = !canonicalTag;
    if (!canonicalTag) {
      canonicalTag = document.createElement("link");
      canonicalTag.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalTag);
    }
    const previousCanonical = canonicalTag.getAttribute("href");
    if (!noindex) {
      canonicalTag.setAttribute("href", window.location.origin + window.location.pathname);
    }

    return () => {
      if (createdRobotsTag) {
        robotsTag.remove();
      } else if (previousRobots !== null) {
        robotsTag.setAttribute("content", previousRobots);
      }
      if (createdCanonicalTag) {
        canonicalTag.remove();
      } else if (previousCanonical !== null) {
        canonicalTag.setAttribute("href", previousCanonical);
      }
    };
  }, [noindex]);
}
