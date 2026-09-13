import { createStudySketch } from "../study-controls.js";
import { drawRoundedPanels, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "rounded-panels", title: "Rounded panels", ...pathsASettings["rounded-panels"], draw: drawRoundedPanels });
