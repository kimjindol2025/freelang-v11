console.log(((()=>{let n=10;let p=1;while(true){let __r=(()=>{return ((n===0)?p:{__recur:true,a:[(n-1),(p*n)]});})();if(__r&&__r.__recur){[n,p]=__r.a;continue;}return __r;}})()));
