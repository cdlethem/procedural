export const systemsAStudies=[
["stream-ribbons","Stream ribbons","Fields & paths",["rk4-vector-grid-trace-2d"],"drawStreamRibbons","Lanes",30],["curved-trajectories","Curved trajectories","Fields & paths",["rk4-vector-grid-trace-2d"],"drawCurvedTrajectories","Steps",86],
["reaction-spots","Reaction spots","Fields & paths",["gray-scott-step-2d"],"drawReactionSpots","Passes",22],["reaction-stripes","Reaction stripes","Fields & paths",["gray-scott-step-2d"],"drawReactionStripes","Scale",9],
["organic-cells","Organic cells","Shapes & space",["life-like-step-2d"],"drawOrganicCells","Passes",14],["geometric-generations","Geometric generations","Shapes & space",["life-like-step-2d"],"drawGeometricGenerations","Cell size",14],
["woven-rows","Woven rows","Layouts",["elementary-cellular-rows"],"drawWovenRows","Rule",30],["triangle-glyphs","Triangle glyphs","Layouts",["elementary-cellular-rows"],"drawTriangleGlyphs","Rows",38],
["swirling-particles","Swirling particles","Fields & paths",["scalar-grid-curl-2d","rk4-vector-grid-trace-2d"],"drawSwirlingParticles","Count",60],["flow-needles","Flow needles","Fields & paths",["scalar-grid-curl-2d"],"drawFlowNeedles","Columns",30],
].map(([slug,title,category,operations,draw,label,value])=>({slug,title,category,operations,draw,structuralControl:{label,value}}));
