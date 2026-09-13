import { createStudySketch } from "../study-controls.js";
import { drawContourAbstraction, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "contour-abstraction", title: "Contour abstraction", ...pathsASettings["contour-abstraction"], draw: drawContourAbstraction });
