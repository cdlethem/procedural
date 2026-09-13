export const systemsBStudies = [
 ["ripple-interference","Ripple interference","Fields & paths",["damped-wave-step-2d"],"drawRippleInterference","Passes",34],
 ["pinned-waves","Pinned waves","Fields & paths",["damped-wave-step-2d"],"drawPinnedWaves","Scale",13],
 ["branching-sentences","Branching sentences","Fields & paths",["parallel-token-rewrite","token-turtle-2d"],"drawBranchingSentences","Iterations",5],
 ["woven-grammar","Woven grammar","Shapes & space",["parallel-token-rewrite","token-turtle-2d"],"drawWovenGrammar","Angle",38],
 ["turtle-canopies","Turtle canopies","Fields & paths",["token-turtle-2d","parallel-token-rewrite"],"drawTurtleCanopies","Depth",6],
 ["recursive-tiles","Recursive tiles","Shapes & space",["token-turtle-2d","parallel-token-rewrite"],"drawRecursiveTiles","Depth",5],
 ["compatible-mosaics","Compatible mosaics","Shapes & space",["adjacency-tile-collapse-2d"],"drawCompatibleMosaics","Columns",18],
 ["tiled-circuits","Tiled circuits","Layouts",["adjacency-tile-collapse-2d"],"drawTiledCircuits","Rows",18],
 ["maze-gardens","Maze gardens","Fields & paths",["seeded-depth-first-spanning-tree"],"drawMazeGardens","Columns",25],
 ["branching-networks","Branching networks","Fields & paths",["seeded-depth-first-spanning-tree"],"drawBranchingNetworks","Rows",20]
].map(([slug,title,category,operations,draw,label,value])=>({slug,title,category,operations,draw,structuralControl:{label,value}}));
