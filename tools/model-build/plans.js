// 导出每个机型的 aircraft3d 规划参数 (zN/groundY 等), 供模型构建脚本对齐
const fs=require('fs'), path=require('path');
const gameDir=process.argv[2];
globalThis.THREE=require(path.join(gameDir,'vendor/three.min.js'));
globalThis.FS={};
for (const f of ['js/utils.js','js/config.js','js/aircraft3d.js']) (0,eval)(fs.readFileSync(path.join(gameDir,f),'utf8'));
const out={};
for(const k of Object.keys(FS.AIRCRAFT_DB)){
  const h=FS.Aircraft3D.create(k,{quality:'medium',procedural:true}); const p=h.plan;
  h.group.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(h.group);
  out[k]={zN:p.zN,zT:p.zT,R:p.R,groundY:p.groundY,engY:p.engY,engR:p.engR,mainAxleY:p.mainAxleY,noseAxleY:p.noseAxleY,ryScale:p.ryScale,flatBottom:p.flatBottom,halfSkin:p.halfSkin,finBase:p.finBase,bbox:[b.min.toArray(),b.max.toArray()],dims:FS.AIRCRAFT_DB[k].dims};
}
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,1));
for(const k in out) console.log(k,'zN',out[k].zN.toFixed(2),'groundY',out[k].groundY.toFixed(2),'engY',out[k].engY.toFixed(2),'engR',out[k].engR.toFixed(2),'bbox',out[k].bbox.map(v=>v.map(x=>x.toFixed(1)).join(',')).join(' | '));
