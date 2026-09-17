# Implicit ray contract review

Root read the complete scene/ray schema, field and termination semantics and independent
analytical fixture cases before implementation. A single CPU hit-record query is admitted;
camera construction, lights, material colors and raster composition remain editable p5 code.
No GPU engine, mesh extraction or public callback tree is admitted.

Root chooses axisBox and translateUniform node tags, conservative undefined normals at
exact box/CSG ties, and range before step exhaustion at an already sampled positive boundary.
Each call reserves R*(S+6)*N node evaluations before ray normalization; complete static
validation precedes caps. The operation normalizes supplied directions and uses the pinned
nested fdlibm hypot, fixed evaluation order and finite checks.

Root corrected an independent proposed overflow oracle: hypot(1e308,1e308) is finite.
The frozen overflow case uses 1.7e308 components. Root inspected the remaining subnormal
overshoot, large-t stalled addition, CSG signs, smooth midpoint, finite-difference normal,
boundary/step precedence and exact budget equality cases. Only the two explicitly named
numeric fields receive their specified fixture tolerances; all statuses/counts remain exact.

Passive ordinary data invoke no callbacks; Proxies are outside portable interchange because
reflection can invoke traps. This makes no impossible universal Proxy-rejection guarantee.
Finite-precision hit records do not certify exact intersections or thin-feature discovery.
Source motivation is the distance-field technique family recorded in the external expansion
plan; native study and target acceptance remain pending.
