import { createStudySketch } from "../study-controls.js";
import { drawStreamRibbons, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "stream-ribbons", title: "Stream ribbons", ...systemsASettings["stream-ribbons"], draw: drawStreamRibbons });
