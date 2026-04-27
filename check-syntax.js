const fs = require('fs');

function countParens(content) {
  let open = 0, close = 0;
  let bracketOpen = 0, bracketClose = 0;
  
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '(') open++;
    else if (c === ')') close++;
    else if (c === '[') bracketOpen++;
    else if (c === ']') bracketClose++;
  }
  
  return { open, close, bracketOpen, bracketClose };
}

function checkFile(path) {
  const content = fs.readFileSync(path, 'utf8');
  const counts = countParens(content);
  console.log(`\n${path}:`);
  console.log(`  ( : ${counts.open}`);
  console.log(`  ) : ${counts.close}`);
  console.log(`  [ : ${counts.bracketOpen}`);
  console.log(`  ] : ${counts.bracketClose}`);
  console.log(`  Balance: ( ${counts.open - counts.close}, [ ${counts.bracketOpen - counts.bracketClose}`);
}

checkFile('self/all.fl');
checkFile('self/codegen.fl');
