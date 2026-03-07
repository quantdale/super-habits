import { Platform } from "react-native";
import { Workbox } from "workbox-window";

let registered = false;

export function registerServiceWorker() {
  if (registered || Platform.OS !== "web") return;
  if (!("serviceWorker" in navigator)) return;

  const wb = new Workbox("/sw.js");
  wb.register();
  registered = true;
}
