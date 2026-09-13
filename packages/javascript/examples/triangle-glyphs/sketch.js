import { createStudySketch } from "../study-controls.js";
import { drawTriangleGlyphs, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "triangle-glyphs", title: "Triangle glyphs", ...systemsASettings["triangle-glyphs"], draw: drawTriangleGlyphs });
