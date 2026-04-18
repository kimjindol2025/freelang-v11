const inc=(x)=>x+1;const dbl=(x)=>x*2;const neg=(x)=>-x;const addn=(x,n)=>x+n;const muln=(x,n)=>x*n;const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{(await sleep(10));return console.log(42);})();
