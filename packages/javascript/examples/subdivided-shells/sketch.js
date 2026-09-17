import { createMeshStudySketch } from "../mesh-study-controls.js";
import { drawSubdividedShells, materialsBSettings } from "../materials-b-studies.js";
createMeshStudySketch({slug:"subdivided-shells",title:"Subdivided shells",...materialsBSettings["subdivided-shells"],draw:drawSubdividedShells});
