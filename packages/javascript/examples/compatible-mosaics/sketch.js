import { createStudySketch } from "../study-controls.js";
import { drawCompatibleMosaics, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "compatible-mosaics", title: "Compatible mosaics", ...systemsBSettings["compatible-mosaics"], draw: drawCompatibleMosaics });
