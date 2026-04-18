const sum = (i,n,acc)=>((i>=n)?acc:sum((i+1),n,(acc+i)));
console.log(sum(0,5001,0))
