import { createStudySketch } from "../study-controls.js";
import { drawOrganicCells, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "organic-cells", title: "Organic cells", ...systemsASettings["organic-cells"], draw: drawOrganicCells });
