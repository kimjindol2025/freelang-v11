const _fl_get=(o,k)=>(o==null?null:(o[k]===undefined?null:o[k]));
const User=(name,age)=>({__struct:"User",name,age});
const u=User("kim",30);
console.log(_fl_get(u,"__struct"));
