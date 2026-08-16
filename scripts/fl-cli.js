#!/usr/bin/env node
const path=require("path");
const {spawn}=require("child_process");
const root=path.resolve(__dirname, "..");
const args=process.argv.slice(2);
if(args.length===0){console.error("사용법: fl <run|serve|repl|compile> ...");process.exit(2);}
const allowed=new Set(["run","serve","repl","compile"]);
if(!allowed.has(args[0])){console.error("사용 가능: run, serve, repl, compile");process.exit(2);}
const child=spawn(process.execPath,[path.join(root,"bootstrap.js"),...args],{cwd:process.cwd(),stdio:"inherit",env:process.env});
child.on("error",e=>{console.error("FreeLang 실행 실패: "+e.message);process.exit(1);});
child.on("exit",(code,signal)=>process.exit(signal?1:(code??1)));
