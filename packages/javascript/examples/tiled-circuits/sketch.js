import { createStudySketch } from "../study-controls.js";
import { drawTiledCircuits, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "tiled-circuits", title: "Tiled circuits", ...systemsBSettings["tiled-circuits"], draw: drawTiledCircuits });
