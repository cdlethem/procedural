import { createMeshStudySketch } from "../mesh-study-controls.js";
import { drawExtrudedSeals, materialsBSettings } from "../materials-b-studies.js";
createMeshStudySketch({slug:"extruded-seals",title:"Extruded seals",...materialsBSettings["extruded-seals"],draw:drawExtrudedSeals});
