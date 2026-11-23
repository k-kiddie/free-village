'use strict';
// 채권의 수령인은 native 사망 처리에서 이미 확정한 상속인만 사용한다.
// 사망 후 가족을 다시 추정하거나 난수를 다시 뽑지 않는다.
const stores=require('./warehousing');
function reasons(world,f){const S=world.S,b=S.business,out=[];
 if(stores.all(world,f.id).some(w=>Object.values(w.inv).some(n=>n>1e-8)))out.push('회사 창고 재고');
 if((b?.orders||[]).some(o=>o.firmId===f.id&&Object.values(o.inv).some(n=>n>1e-8)))out.push('운송/대기 화물');
 if((b?.arrears||[]).some(c=>c.firmId===f.id&&c.amount>1e-8))out.push('미지급 임금');
 if((b?.operations?.[f.id]?.taxDebt||0)>1e-8)out.push('미납 세금');
 if((S.corpLoans||[]).some(l=>l.firm===f.id&&(l.bal||0)>1e-8&&!['paid','closed','forgiven'].includes(l.status)))out.push('기업 대출');
 return out;
}
function inherit(world,decedent,heirs){
 const rate=Math.max(0,Math.min(1,world.S.gov?.policy?.inhTax||0));
 for(const c of world.S.business?.arrears||[]){if(c.amount<=1e-8)continue;const holders=c.holders|| (c.workerId===decedent.id?[{kind:'person',id:decedent.id,share:1,taxRate:0}]:[]);if(!holders.some(h=>h.kind==='person'&&h.id===decedent.id))continue;
  c.holders=holders.flatMap(h=>h.kind!=='person'||h.id!==decedent.id?[h]:heirs.length?heirs.map(a=>({kind:'person',id:a.id,share:h.share/heirs.length,taxRate:1-(1-(h.taxRate||0))*(1-rate),inherited:true})):[{kind:'estate',decedentId:decedent.id,share:h.share,taxRate:h.taxRate||0,inherited:true}]);
  c.successions ||= [];c.successions.push({day:world.S.day,decedentId:decedent.id,heirs:heirs.map(a=>a.id),taxRate:rate});
 }
}
function holders(world,c){const rows=c.holders||[{kind:'person',id:c.workerId,share:1,taxRate:0}];if(rows.some(h=>h.kind==='person'&&!world.S.byId.get(h.id)?.alive))throw Error('사망 당시 상속 수령인이 확인되지 않은 임금채권이 있습니다. 기존 채권을 보존하며 임의로 수령인을 추정하지 않습니다.');return rows;}
function pay(world,f,c){const rows=holders(world,c),S=world.S;c.distributions=[];
 for(const h of rows){const gross=c.amount*h.share;if(!h.inherited&&h.kind==='person'){world.businessPay(f,S.byId.get(h.id),gross,'wage');c.distributions.push({id:h.id,gross,source:'wage'});continue;}
  const tax=S.gov?gross*(h.taxRate||0):0,net=gross-tax;if((f.cash||0)+1e-8<gross)throw Error('임금채권 정산 자금이 모자랍니다.');f.cash-=gross;
  if(tax){S.gov.tre+=tax;if(S.gov.st)S.gov.st.collected=(S.gov.st.collected||0)+tax;}
  if(h.kind==='estate')S.unclaimedCash=(S.unclaimedCash||0)+net;else{const a=S.byId.get(h.id);a.cash+=net;a.src.inherit=(a.src.inherit||0)+net;}
  c.distributions.push({...h,gross,tax,net});
 }
 c.amount=0;c.paidDay=S.day;
}
function validate(world){for(const c of world.S.business?.arrears||[]){if(!c.holders)continue;if(!Array.isArray(c.holders)||!c.holders.length||c.holders.some(h=>!['person','estate'].includes(h.kind)||!Number.isSafeInteger(h.kind==='person'?h.id:h.decedentId)||!Number.isFinite(h.share)||h.share<=0||!Number.isFinite(h.taxRate)||h.taxRate<0||h.taxRate>1)||Math.abs(c.holders.reduce((n,h)=>n+h.share,0)-1)>1e-8)throw Error('임금채권의 상속 수령인 저장을 확인해 주세요.');}}
module.exports={reasons,inherit,holders,pay,validate};
