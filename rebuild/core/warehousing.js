'use strict';
function location(world,w,f){
 if(w?.location)return w.location;
 const receipts=(world.S.business?.orders||[]).filter(o=>o.firmId===f.id&&o.receivedDay!==undefined),places=new Map(receipts.map(o=>[o.destination.lot,o.destination]));
 if(places.size===1)return [...places.values()][0];
 if(!places.size&&f.bld?.length===1){const b=world.S.bldgs.find(b=>b.id===f.bld[0]);return b?point(world,b):null;}return null;
}
function point(world,b){const p=world.S.geo.lots[b.lot];return {buildingId:b.id,lot:b.lot,x:p.x+5,y:p.y+5};}
function building(world,f,id){return world.S.bldgs.find(b=>b.id===id&&f.bld?.includes(b.id)&&b.firm===f.id&&(b.cond??1)>.25);}
function activeId(world,f){return world.S.business?.operations?.[f.id]?.buildingId||location(world,world.S.business?.warehouses[f.id],f)?.buildingId||f.bld?.find(id=>building(world,f,id));}
function key(world,f,id){const primary=world.S.business?.warehouses[f.id];return !primary||location(world,primary,f)?.buildingId===id||(!primary.location&&!Object.values(primary.inv).some(n=>n>1e-8))?String(f.id):`${f.id}@${id}`;}
function get(world,f,id=activeId(world,f),create=false){const b=world.S.business,k=key(world,f,id);let w=b?.warehouses[k];if(!w&&create){const site=building(world,f,id);if(!site)throw Error('사용할 수 있는 회사 창고 시설이 없습니다.');w=b.warehouses[k]={warehouseId:k,firmId:f.id,name:f.name,location:point(world,site),inv:{},quality:{},cost:{}};}return w;}
function all(world,id){return Object.values(world.S.business?.warehouses||{}).filter(w=>w.firmId===id);}
module.exports={location,point,building,activeId,key,get,all};
