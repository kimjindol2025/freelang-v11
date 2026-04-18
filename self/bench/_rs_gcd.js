const math_gcd = (a,b)=>((b===0)?a:math_gcd(b,(a%b)));
console.log(math_gcd(48,18))
