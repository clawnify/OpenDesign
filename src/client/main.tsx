import { render } from "preact";
import * as fabric from "fabric";
import { App } from "./app";
import "./styles.css";

// Fabric v6 drops unknown properties on serialize, and `canvas.toJSON()` takes
// no argument list any more. Registering them here is what makes them survive
// every save and reload, without touching the toJSON call sites. `maxLines` and
// `fitFontSize` are the fit-to-lines setting (lib/fit-text.ts).
fabric.FabricObject.customProperties = ["fieldName", "maxLines", "fitFontSize"];

render(<App />, document.getElementById("app")!);
