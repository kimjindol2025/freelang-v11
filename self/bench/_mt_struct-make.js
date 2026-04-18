const _fl_get=(o,k)=>(o==null?null:(o[k]===undefined?null:o[k]));
const Point=(x,y)=>({__struct:"Point",x,y});
const p=Point(3,4);
console.log((_fl_get(p,"x")+_fl_get(p,"y")));
