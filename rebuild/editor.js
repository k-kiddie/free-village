"use strict";
module.exports = function editor(C) {
  return {
    command(c) {
      if (!c.action.startsWith("edit:")) return false;
      if (!C.editor) throw Error("세계 편집은 별도 실험실에서만 가능합니다");
      const S = C.S;
      switch (c.action) {
        case "edit:district": {
          const d = C.district(c.district);
          if (
            !["road", "school", "homes", "raw"].includes(c.key) ||
            !Number.isFinite(c.value) ||
            c.value < 0 ||
            c.value > 10000
          )
            throw Error("편집 범위를 확인하세요");
          d[c.key] = c.value;
          break;
        }
        case "edit:person": {
          const p = C.person(c.person);
          if (
            !["skill", "relation", "loyalty", "ambition"].includes(c.key) ||
            !Number.isFinite(c.value) ||
            c.value < 0 ||
            c.value > 100
          )
            throw Error("인물 편집 범위를 확인하세요");
          p[c.key] = c.value;
          break;
        }
        case "edit:transfer": {
          if (!Number.isFinite(c.value) || c.value < 0)
            throw Error("금액이 올바르지 않습니다");
          if (c.value > S.market) throw Error("외부 시장 계정이 부족합니다");
          C.pay(C.market(), S.player, c.value);
          break;
        }
        case "edit:government": {
          if (
            !["administration", "army", "legitimacy"].includes(c.key) ||
            !Number.isFinite(c.value) ||
            c.value < 0 ||
            c.value > 100
          )
            throw Error("정부 편집 범위를 확인하세요");
          S.government[c.key] = c.value;
          break;
        }
        default:
          throw Error("지원하지 않는 편집입니다");
      }
      C.note(
        "실험실 편집",
        "별도 실험 저장에만 반영됐습니다. 일반 플레이의 권한과 예산 규칙은 유지됩니다.",
      );
      return true;
    },
  };
};
