"use strict";
// FreeLang v9: Type Class Evaluation
// Phase 58: interpreter.ts에서 분리된 타입 클래스 로직
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBuiltinTypeClasses = registerBuiltinTypeClasses;
exports.evalTypeClass = evalTypeClass;
exports.evalInstance = evalInstance;
function registerBuiltinTypeClasses(interp) {
    if (!interp.context.typeClasses || !interp.context.typeClassInstances)
        return;
    const bindMonad = (monad, fn) => {
        if (monad?.kind === "Result") {
            return monad.tag === "Ok" ? interp.callFunction(fn, [monad.value]) : monad;
        }
        if (monad?.kind === "Option") {
            return monad.tag === "Some" ? interp.callFunction(fn, [monad.value]) : monad;
        }
        return monad;
    };
    const bindList = (list, fn) => {
        let result = [];
        for (const item of list) {
            const t = interp.callFunction(fn, [item]);
            result = result.concat(Array.isArray(t) ? t : [t]);
        }
        return result;
    };
    const mapResult = (r, fn) => r?.tag === "Ok" ? { tag: "Ok", value: interp.callFunction(fn, [r.value]), kind: "Result" } : r;
    const mapOption = (o, fn) => o?.tag === "Some" ? { tag: "Some", value: interp.callFunction(fn, [o.value]), kind: "Option" } : o;
    const mapList = (list, fn) => list.map((item) => interp.callFunction(fn, [item]));
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
            ["pure", (x) => ({ tag: "Ok", value: x, kind: "Result" })],
            ["bind", bindMonad],
            ["map", mapResult],
        ]),
    });
    interp.context.typeClassInstances.set("Monad[Option]", {
        className: "Monad",
        concreteType: "Option",
        implementations: new Map([
            ["pure", (x) => ({ tag: "Some", value: x, kind: "Option" })],
            ["bind", bindMonad],
            ["map", mapOption],
        ]),
    });
    interp.context.typeClassInstances.set("Monad[List]", {
        className: "Monad",
        concreteType: "List",
        implementations: new Map([
            ["pure", (x) => [x]],
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
function evalTypeClass(interp, typeClass) {
    const info = {
        name: typeClass.name,
        typeParams: typeClass.typeParams,
        methods: new Map(),
    };
    if (typeClass.methods) {
        typeClass.methods.forEach((_method, methodName) => {
            info.methods.set(methodName, methodName);
        });
    }
    interp.context.typeClasses.set(typeClass.name, info);
    interp.logger.info(`✅ Registered TYPECLASS "${typeClass.name}" with type params [${typeClass.typeParams.join(", ")}] and ${info.methods.size} method(s)`);
}
function evalInstance(interp, instance) {
    const key = `${instance.className}[${instance.concreteType}]`;
    const implementations = new Map();
    if (instance.implementations) {
        instance.implementations.forEach((value, methodName) => {
            implementations.set(methodName, interp.eval(value));
        });
    }
    const info = {
        className: instance.className,
        concreteType: instance.concreteType,
        implementations,
    };
    interp.context.typeClassInstances.set(key, info);
    interp.logger.info(`✅ Registered INSTANCE of "${instance.className}" for type "${instance.concreteType}" with ${implementations.size} method(s)`);
}
//# sourceMappingURL=eval-type-classes.js.map