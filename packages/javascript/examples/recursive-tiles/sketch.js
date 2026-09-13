import { createStudySketch } from "../study-controls.js";
import { drawRecursiveTiles, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "recursive-tiles", title: "Recursive tiles", ...systemsBSettings["recursive-tiles"], draw: drawRecursiveTiles });
