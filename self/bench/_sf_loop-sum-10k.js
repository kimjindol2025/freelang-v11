console.log(((()=>{let i=0;let acc=0;while(true){let __r=(()=>{return ((i>=10001)?acc:{__recur:true,a:[(i+1),(acc+i)]});})();if(__r&&__r.__recur){[i,acc]=__r.a;continue;}return __r;}})()));
