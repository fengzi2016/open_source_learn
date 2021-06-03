import { reroute } from "./lifecycles/reroute.js";
import { isInBrowser } from './applications/app.js';
import { setUrlRerouteOnly } from "./navigation/navigation-events.js";


let started = false;

export function start(opts) {
  started = true;
  if (opts && opts.urlRerouteOnly) {
    setUrlRerouteOnly(opts.urlRerouteOnly);
  }
  if (isInBrowser) {
    reroute();
  }
}

export function isStarted() {
  return started;
}

