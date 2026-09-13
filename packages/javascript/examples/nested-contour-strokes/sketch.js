import { createStudySketch } from "../study-controls.js";
import { drawNestedContourStrokes, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "nested-contour-strokes", title: "Nested contour strokes", ...pathsASettings["nested-contour-strokes"], draw: drawNestedContourStrokes });
