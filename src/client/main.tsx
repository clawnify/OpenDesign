import { render } from "preact";
import * as fabric from "fabric";
import { App } from "./app";
import "./styles.css";

// Fabric v6 drops unknown properties on serialize, and `canvas.toJSON()` takes
// no argument list any more. Registering them here is what makes them survive
// every save and reload, without touching the toJSON call sites. `maxLines` and
// `fitFontSize` are the fit-to-lines setting (lib/fit-text.ts).
fabric.FabricObject.customProperties = ["_isBgImage", "layerId", "fieldName", "maxLines", "fitFontSize"];

// Agent mode (`?agent` in the address): bigger targets and every hover-only
// control shown, from the [data-agent] rules in styles.css.
if (new URLSearchParams(window.location.search).has("agent")) {
  document.documentElement.dataset.agent = "";
}

render(<App />, document.getElementById("app")!);
