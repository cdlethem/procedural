import { createStudySketch } from "../study-controls.js";
import { drawTerracedIslands, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "terraced-islands", title: "Terraced islands", ...pathsASettings["terraced-islands"], draw: drawTerracedIslands });
