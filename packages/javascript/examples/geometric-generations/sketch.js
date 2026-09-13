import { createStudySketch } from "../study-controls.js";
import { drawGeometricGenerations, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "geometric-generations", title: "Geometric generations", ...systemsASettings["geometric-generations"], draw: drawGeometricGenerations });
