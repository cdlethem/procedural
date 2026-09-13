import { createStudySketch } from "../study-controls.js";
import { drawConcaveGrain, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "concave-grain", title: "Concave grain", ...pathsASettings["concave-grain"], draw: drawConcaveGrain });
