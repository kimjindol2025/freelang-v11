#!/usr/bin/env node
const path=require("path");
const {spawn}=require("child_process");
const root=path.resolve(__dirname, "..");
const aiProject=require("./ai-project");
const args=process.argv.slice(2);
if(args.length===0){console.error("사용법: fl <run|serve|repl|compile|inspect|verify> ...");process.exit(2);}
const allowed=new Set(["run","serve","repl","compile","inspect","verify"]);
if(!allowed.has(args[0])){console.error("사용 가능: run, serve, repl, compile, inspect, verify");process.exit(2);}
if(args[0]==="inspect")process.exit(aiProject.inspect(process.cwd(),args.slice(1)));
if(args[0]==="verify")process.exit(aiProject.verify(process.cwd(),args.slice(1)));
const child=spawn(process.execPath,[path.join(root,"bootstrap.js"),...args],{cwd:process.cwd(),stdio:"inherit",env:process.env});
child.on("error",e=>{console.error("FreeLang 실행 실패: "+e.message);process.exit(1);});
child.on("exit",(code,signal)=>process.exit(signal?1:(code??1)));
