const range_loop = (s,e,acc)=>((s>=e)?acc:range_loop((s+1),e,(acc+s)));
console.log(range_loop(0))
