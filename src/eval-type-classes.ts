// FreeLang v9: Type Class Evaluation
// Phase 58: interpreter.ts에서 분리된 타입 클래스 로직

import { TypeClass, TypeClassInstance } from "./ast";
import type { TypeClassInfo, TypeClassInstanceInfo } from "./interpreter-context";

// Minimal Interpreter interface (순환 import 방지)
interface InterpreterLike {
  eval(node: any): any;
  callFunction(fn: any, args: any[]): any;
  logger: { info(msg: string): void };
  context: {
    typeClasses?: Map<string, TypeClassInfo>;
    typeClassInstances?: Map<string, TypeClassInstanceInfo>;
  };
}

export function registerBuiltinTypeClasses(interp: InterpreterLike): void {
  if (!interp.context.typeClasses || !interp.context.typeClassInstances) return;

  const bindMonad = (monad: any, fn: any): any => {
    if (monad?.kind === "Result") {
      return monad.tag === "Ok" ? interp.callFunction(fn, [monad.value]) : monad;
    }
    if (monad?.kind === "Option") {
      return monad.tag === "Some" ? interp.callFunction(fn, [monad.value]) : monad;
    }
    return monad;
  };
  const bindList = (list: any[], fn: any): any[] => {
    let result: any[] = [];
    for (const item of list) {
      const t = interp.callFunction(fn, [item]);
      result = result.concat(Array.isArray(t) ? t : [t]);
    }
    return result;
  };
  const mapResult = (r: any, fn: any) =>
    r?.tag === "Ok" ? { tag: "Ok", value: interp.callFunction(fn, [r.value]), kind: "Result" } : r;
  const mapOption = (o: any, fn: any) =>
    o?.tag === "Some" ? { tag: "Some", value: interp.callFunction(fn, [o.value]), kind: "Option" } : o;
  const mapList = (list: any[], fn: any) => list.map((item: any) => interp.callFunction(fn, [item]));

  interp.context.typeClasses.set("Monad", {
    name: "Monad",
    typeParams: ["M"],
    methods: new Map([
      ["pure", "fn [a] (M a)"],
      ["bind", "fn [m f] (M b)"],
      ["map", "fn [m f] (M b)"],
    ]),
  });

  interp.context.typeClasses.set("Functor", {
    name: "Functor",
    typeParams: ["F"],
    methods: new Map([["fmap", "fn [f a] (F a)"]]),
  });

  interp.context.typeClassInstances.set("Monad[Result]", {
    className: "Monad",
    concreteType: "Result",
    implementations: new Map([
      ["pure", (x: any) => ({ tag: "Ok", value: x, kind: "Result" })],
      ["bind", bindMonad],
      ["map", mapResult],
    ]),
  });

  interp.context.typeClassInstances.set("Monad[Option]", {
    className: "Monad",
    concreteType: "Option",
    implementations: new Map([
      ["pure", (x: any) => ({ tag: "Some", value: x, kind: "Option" })],
      ["bind", bindMonad],
      ["map", mapOption],
    ]),
  });

  interp.context.typeClassInstances.set("Monad[List]", {
    className: "Monad",
    concreteType: "List",
    implementations: new Map([
      ["pure", (x: any) => [x]],
      ["bind", bindList],
      ["map", mapList],
    ]),
  });

  interp.context.typeClassInstances.set("Functor[Result]", {
    className: "Functor",
    concreteType: "Result",
    implementations: new Map([["fmap", mapResult]]),
  });

  interp.context.typeClassInstances.set("Functor[Option]", {
    className: "Functor",
    concreteType: "Option",
    implementations: new Map([["fmap", mapOption]]),
  });

  interp.context.typeClassInstances.set("Functor[List]", {
    className: "Functor",
    concreteType: "List",
    implementations: new Map([["fmap", mapList]]),
  });
}

export function evalTypeClass(interp: InterpreterLike, typeClass: TypeClass): void {
  const info: TypeClassInfo = {
    name: typeClass.name,
    typeParams: typeClass.typeParams,
    methods: new Map(),
  };

  if (typeClass.methods) {
    typeClass.methods.forEach((_method, methodName) => {
      info.methods.set(methodName, methodName);
    });
  }

  interp.context.typeClasses!.set(typeClass.name, info);
  interp.logger.info(
    `✅ Registered TYPECLASS "${typeClass.name}" with type params [${typeClass.typeParams.join(", ")}] and ${info.methods.size} method(s)`
  );
}

export function evalInstance(interp: InterpreterLike, instance: TypeClassInstance): void {
  const key = `${instance.className}[${instance.concreteType}]`;
  const implementations = new Map<string, any>();

  if (instance.implementations) {
    instance.implementations.forEach((value, methodName) => {
      implementations.set(methodName, interp.eval(value));
    });
  }

  const info: TypeClassInstanceInfo = {
    className: instance.className,
    concreteType: instance.concreteType,
    implementations,
  };

  interp.context.typeClassInstances!.set(key, info);
  interp.logger.info(
    `✅ Registered INSTANCE of "${instance.className}" for type "${instance.concreteType}" with ${implementations.size} method(s)`
  );
}
