import { createStudySketch } from "../study-controls.js";
import { drawDitheredRibbons, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "dithered-ribbons", title: "Dithered ribbons", ...materialsASettings["dithered-ribbons"], draw: drawDitheredRibbons });
