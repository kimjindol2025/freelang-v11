const grade = (s)=>((s>=90)?"A":((s>=80)?"B":((s>=70)?"C":(true?"F":null))));
console.log(grade(87))
