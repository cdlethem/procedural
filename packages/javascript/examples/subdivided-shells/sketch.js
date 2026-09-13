import { createStudySketch } from "../study-controls.js";
import { drawSubdividedShells, materialsBSettings } from "../materials-b-studies.js";
createStudySketch({slug:"subdivided-shells",title:"Subdivided shells",...materialsBSettings["subdivided-shells"],draw:drawSubdividedShells});
