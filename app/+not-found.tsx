import { Redirect } from 'expo-router';

/**
 * Unmatched URLs in this single-page app have no meaningful content: every tab
 * is in-app state behind `/`. Redirecting during the route's first client
 * render (expo-router's `Redirect` runs in a focus effect) keeps the DOM
 * contract with the static export, whose deep links are served from `index.html`.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
