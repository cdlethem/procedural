import { createStudySketch } from "../study-controls.js";
import { drawRoadMargins, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "road-margins", title: "Road margins", ...pathsASettings["road-margins"], draw: drawRoadMargins });
