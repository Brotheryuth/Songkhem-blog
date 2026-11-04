const fs=require('fs');const b=fs.readFileSync(process.argv[2]);const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString());
const a=j.animations[0];const ins=new Set(a.samplers.map(s=>s.input));
for(const i of ins){const acc=j.accessors[i];console.log('input',i,'count',acc.count,'min',acc.min,'max',acc.max);}
const thumbNodes=j.nodes.map((n,i)=>[i,n.name]).filter(([i,n])=>/thumb/.test(n));
console.log('thumb nodes',thumbNodes.map(x=>x[1]).join(','));
for(const ch of a.channels){const n=j.nodes[ch.target.node].name;if(/thumb_0/.test(n)){const s=a.samplers[ch.sampler];console.log(n,ch.target.path,'keys',j.accessors[s.input].count);}}
console.log('nodes',j.nodes.length,'anchor',j.nodes.find(n=>n.name==='PhoneAnchor'));
