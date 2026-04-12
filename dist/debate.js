"use strict";
// FreeLang v9 Debate — 내부 찬반 에이전트 토론
// Phase 113: [DEBATE :proposition "..." :pro fn :con fn :rounds 3 :judge fn]
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalDebater = exports.Debater = void 0;
class Debater {
    debate(config) {
        const { proposition, pro, con, rounds = 3 } = config;
        const judge = config.judge ?? ((p, c) => p > c ? 'pro' : c > p ? 'con' : 'tie');
        const debateRounds = [];
        const proArgs = [];
        const conArgs = [];
        for (let r = 1; r <= rounds; r++) {
            const proArg = pro(r, conArgs);
            proArgs.push(proArg);
            const conArg = con(r, proArgs);
            conArgs.push(conArg);
            debateRounds.push({ round: r, proArgument: proArg, conArgument: conArg });
        }
        const proScore = proArgs.reduce((s, a) => s + a.strength, 0) / proArgs.length;
        const conScore = conArgs.reduce((s, a) => s + a.strength, 0) / conArgs.length;
        const winner = judge(proScore, conScore);
        const conclusion = winner === 'tie'
            ? `"${proposition}" — 팽팽한 논쟁 (pro: ${proScore.toFixed(2)}, con: ${conScore.toFixed(2)})`
            : `"${proposition}" — ${winner === 'pro' ? '채택' : '기각'} (승자: ${winner})`;
        return { proposition, winner, proScore, conScore, rounds: debateRounds, conclusion };
    }
}
exports.Debater = Debater;
exports.globalDebater = new Debater();
//# sourceMappingURL=debate.js.map