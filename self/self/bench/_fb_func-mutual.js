const even_q = (n)=>((n===0)?1:odd_q((n-1)));
const odd_q = (n)=>((n===0)?0:even_q((n-1)));
console.log(even_q(10))
