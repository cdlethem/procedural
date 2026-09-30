import { readFileSync, readdirSync } from "node:fs";
import { definition } from "../../dist/index.js";
import { cubesToCondition, learnCubes } from "./audit-learn.ts";
for (const file of readdirSync("/tmp/f9/dump")) {
  const [id] = file.split(".");
  const { set, discrete, numbers } = JSON.parse(readFileSync(`/tmp/f9/dump/${file}`, "utf8"));
  const item = definition(id);
  const pick = (keys: string[]) => keys.map((key) => item.parameters.find((p) => p.key === key)!);
  const cubes = learnCubes(set, pick(discrete), [], (m) => console.log(`  why(discrete): ${m}`)) ?? learnCubes(set, pick(discrete), pick(numbers), (m) => console.log(`  why: ${m}`));
  console.log(file, cubes ? JSON.stringify(cubesToCondition(cubes, [...pick(discrete), ...pick(numbers)])) : "none");
}
