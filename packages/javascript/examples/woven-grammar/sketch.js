import { createStudySketch } from "../study-controls.js";
import { drawWovenGrammar, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "woven-grammar", title: "Woven grammar", ...systemsBSettings["woven-grammar"], draw: drawWovenGrammar });
