// Canvas fonts, bundled with the app (latin subset) so designs render the same
// wherever the app runs, with no request to a third-party font CDN.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-500.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-800.css";
import "@fontsource/playfair-display/latin-900.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/open-sans/latin-400.css";
import "@fontsource/open-sans/latin-600.css";
import "@fontsource/open-sans/latin-700.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/raleway/latin-400.css";
import "@fontsource/raleway/latin-500.css";
import "@fontsource/raleway/latin-600.css";
import "@fontsource/source-sans-pro/latin-400.css";
import "@fontsource/source-sans-pro/latin-600.css";
import "@fontsource/source-sans-pro/latin-700.css";
import "@fontsource/merriweather/latin-400.css";
import "@fontsource/merriweather/latin-700.css";

const FAMILIES: Record<string, number[]> = {
  Inter: [400, 500, 600, 700],
  "Playfair Display": [400, 500, 600, 700, 800, 900],
  Montserrat: [400, 500, 600, 700, 800, 900],
  Poppins: [400, 500, 600, 700],
  Roboto: [400, 500, 700],
  "Open Sans": [400, 600, 700],
  Lora: [400, 700],
  Raleway: [400, 500, 600],
  "Source Sans Pro": [400, 600, 700],
  Merriweather: [400, 700],
};

/** Start loading every canvas font. The canvas draws text with whatever is loaded. */
export function loadFonts(): void {
  for (const [family, weights] of Object.entries(FAMILIES)) {
    for (const weight of weights) {
      document.fonts.load(`${weight} 16px "${family}"`).catch(() => {});
    }
  }
}
