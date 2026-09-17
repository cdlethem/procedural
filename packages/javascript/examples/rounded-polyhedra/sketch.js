import { createMeshStudySketch } from "../mesh-study-controls.js";
import { drawRoundedPolyhedra, materialsBSettings } from "../materials-b-studies.js";
createMeshStudySketch({slug:"rounded-polyhedra",title:"Rounded polyhedra",...materialsBSettings["rounded-polyhedra"],draw:drawRoundedPolyhedra});
