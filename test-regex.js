const name = "identity[int]";
const bracketMatch = name.match(/^([\w\-]+)\[([^\]]+)\]$/);
console.log("Input:", name);
console.log("Match:", bracketMatch);
if (bracketMatch) {
  console.log("Base name:", bracketMatch[1]);
  console.log("Type args:", bracketMatch[2]);
}
