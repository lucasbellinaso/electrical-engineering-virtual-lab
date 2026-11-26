const colors={vc:'#258bc5',vR:'#c4872b',vL:'#8c6bd0',il:'#258bc5',iR:'#c4872b',iC:'#249c81',source:'#889ca9'};
// These frozen reference ranges were computed from complete default runs,
// including every trace in each experiment, with a 10% envelope margin.
// RC: V[0,5], I[0,5]mA; RL: V[0,5], I[0,49.6631]mA;
// series RLC: V[-3.72033,8.64614], I[-31.4524,43.1294]mA;
// parallel RLC: V[-.790398,1.77880], I[-12.6567,36.1084]mA.
const reference={rc:{voltage:[-.5,5.5],current:[-.5,5.5]},rl:{voltage:[-.5,5.5],current:[-5,55]},series:{voltage:[-4.957,9.883],current:[-38.911,50.588]},parallel:{voltage:[-1.048,2.036],current:[-17.534,40.985]}};
export function referenceRange(topology,quantity){return [...reference[topology][quantity]];}
export function traces(topology,quantity){
 if(quantity==='voltage')return topology==='parallel'?['vc']:topology==='rl'?['vL','vR','source']:topology==='series'?['vc','vR','vL','source']:['vc','vR','source'];
 return topology==='parallel'?['il','iR','iC','source']:topology==='rc'?['iC']:['il'];
}
export function color(key){return colors[key];}
export function traceLabel(topology,key,t){return key==='source'?t(topology==='parallel'?'circuit_currentSource':'circuit_voltageSource'):t(`circuit_${key}`);}
function analytical(result,quantity,top){return s=>quantity==='voltage'?(top==='rl'?s.source-result.parameters.resistance*s.exactIL:s.exactVC):(top==='rc'?(s.source-s.exactVC)/result.parameters.resistance:s.exactIL);}
export function dataRange(result,quantity,visible){
 const top=result.parameters.topology,scale=quantity==='current'?1000:1;let low=Infinity,high=-Infinity;
 for(const s of result.samples){for(const key of traces(top,quantity))if(visible.has(key)){const v=s[key]*scale;low=Math.min(low,v);high=Math.max(high,v);}if(visible.has(quantity==='voltage'?(top==='rl'?'vL':'vc'):(top==='rc'?'iC':'il'))){const v=analytical(result,quantity,top)(s)*scale;low=Math.min(low,v);high=Math.max(high,v);}}
 if(!Number.isFinite(low)||!Number.isFinite(high))return referenceRange(top,quantity);
 if(high===low){const margin=Math.max(Math.abs(high)*.1,quantity==='current'?.1:.1);return [low-margin,high+margin];}
 const pad=(high-low)*.1;return [low-pad,high+pad];
}
export function chart(svg,result,quantity,visible,showAnalytical,t,fmt,range=referenceRange(result.parameters.topology,quantity)){
 const all=traces(result.parameters.topology,quantity),keys=all.filter(key=>visible.has(key)),scale=quantity==='current'?1000:1,unit=quantity==='current'?'mA':'V',samples=result.samples;
 const [low,high]=range;
 const stride=Math.max(1,Math.ceil((samples.length-1)/1800)),preview=samples.filter((_,j)=>j%stride===0||j===samples.length-1);
 const x=time=>64+time/samples.at(-1).time*746,y=value=>244-(value-low)/(high-low)*212;
 const path=get=>preview.map((s,j)=>`${j?'L':'M'}${x(s.time).toFixed(2)},${y(get(s)*scale).toFixed(2)}`).join(' ');
 const id=`clip-${quantity}`;let html=`<title>${t(quantity==='current'?'circuit_currentPlot':'circuit_voltagePlot')}</title><desc>${t('circuit_chartDescription')}</desc><defs><clipPath id="${id}"><rect x="64" y="32" width="746" height="212"/></clipPath></defs>`;
 for(let j=0;j<=5;j++){const value=low+(high-low)*j/5,time=samples.at(-1).time*j/5;html+=`<path d="M64 ${y(value)}H810" stroke="#8fa8b8" stroke-width=".4"/><text x="57" y="${y(value)+3}" text-anchor="end">${fmt(value,3)}</text><text x="${x(time)}" y="264" text-anchor="middle">${fmt(time*1000,3)}</text>`;}
 html+=`<path d="M64 32V244H810" fill="none" stroke="currentColor" stroke-width=".8"/><text transform="translate(15 138) rotate(-90)" text-anchor="middle">${unit}</text><text x="437" y="290" text-anchor="middle">${t('timeAxis')}</text>`;
 html+='<g clip-path="url(#'+id+')">';
 for(const key of keys)html+=`<path d="${path(s=>s[key])}" stroke="${colors[key]}" stroke-width="2" fill="none" ${key==='source'?'stroke-dasharray="7 5"':''}/>`;
 const top=result.parameters.topology,primary=quantity==='voltage'?(top==='rl'?'vL':'vc'):(top==='rc'?'iC':'il');
 if(showAnalytical&&visible.has(primary))html+=`<path d="${path(analytical(result,quantity,top))}" stroke="#db785e" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/>`;
 html+='</g>';
 const outside=valuesOutside(result,quantity,visible,low,high);
 if(!keys.length)html+=`<text x="437" y="140" text-anchor="middle">${t('circuit_noTraces')}</text>`;
 html+='<g class="probe"></g>';svg.innerHTML=html;svg.dataset.yMin=String(low);svg.dataset.yMax=String(high);svg.dataset.outOfRange=String(outside);
 return {x,y,scale,keys,low,high,outside};
}
function valuesOutside(result,quantity,visible,low,high){const top=result.parameters.topology,scale=quantity==='current'?1000:1,primary=quantity==='voltage'?(top==='rl'?'vL':'vc'):(top==='rc'?'iC':'il');for(const s of result.samples){for(const key of traces(top,quantity))if(visible.has(key)){const v=s[key]*scale;if(v<low||v>high)return true;}if(visible.has(primary)){const v=analytical(result,quantity,top)(s)*scale;if(v<low||v>high)return true;}}return false;}
export function probe(svg,geometry,sample){svg.querySelector('.probe').innerHTML=`<g clip-path="url(#clip-${geometry.scale===1000?'current':'voltage'})"><path d="M${geometry.x(sample.time)} 32V244" stroke="#7696ac" stroke-dasharray="3 4"/>`+geometry.keys.map(key=>`<circle cx="${geometry.x(sample.time)}" cy="${geometry.y(sample[key]*geometry.scale)}" r="3" fill="${colors[key]}" stroke="white" stroke-width="1"/>`).join('')+'</g>';}
export function imageBlob(svgs,title){
 const ns='http://www.w3.org/2000/svg',root=document.createElementNS(ns,'svg');root.setAttribute('viewBox','0 0 840 660');root.setAttribute('width','1680');root.setAttribute('height','1320');root.setAttribute('xmlns',ns);
 const background=document.createElementNS(ns,'rect');background.setAttribute('width','840');background.setAttribute('height','660');background.setAttribute('fill','white');root.append(background);
 const heading=document.createElementNS(ns,'text');heading.setAttribute('x','35');heading.setAttribute('y','25');heading.textContent=title;root.append(heading);
 const style=document.createElementNS(ns,'style');style.textContent='text{font:11px Segoe UI,Arial,sans-serif;fill:#172f43}svg{color:#172f43}';root.append(style);
 svgs.forEach((svg,j)=>{const copy=svg.cloneNode(true);copy.removeAttribute('id');copy.setAttribute('width','840');copy.setAttribute('height','300');copy.setAttribute('x','0');copy.setAttribute('y',String(45+j*305));copy.style.color='#172f43';root.append(copy);});
 return new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml;charset=utf-8'});
}
