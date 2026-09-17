import { createCellularStudySketch } from "../cellular-quality-controls.js";
import { drawOrganicCells } from "../systems-a-studies.js";

createCellularStudySketch({ slug: "organic-cells", title: "Organic cells", legacyDraw: drawOrganicCells });
