const colors={vc:'#258bc5',vR:'#c4872b',vL:'#8c6bd0',il:'#258bc5',iR:'#c4872b',iC:'#249c81',source:'#889ca9'};
export function traces(topology,quantity){
 if(quantity==='voltage')return topology==='parallel'?['vc']:topology==='rl'?['vL','vR','source']:topology==='series'?['vc','vR','vL','source']:['vc','vR','source'];
 return topology==='parallel'?['il','iR','iC','source']:topology==='rc'?['iC']:['il'];
}
export function color(key){return colors[key];}
export function traceLabel(topology,key,t){return key==='source'?t(topology==='parallel'?'circuit_currentSource':'circuit_voltageSource'):t(`circuit_${key}`);}
export function chart(svg,result,quantity,visible,showAnalytical,t,fmt){
 const all=traces(result.parameters.topology,quantity),keys=all.filter(key=>visible.has(key)),scale=quantity==='current'?1000:1,unit=quantity==='current'?'mA':'V',samples=result.samples;
 // Uniform preview; all integration samples remain available through CSV and inspector.
 const stride=Math.max(1,Math.ceil((samples.length-1)/1800)),preview=samples.filter((_,j)=>j%stride===0||j===samples.length-1);
 const values=preview.flatMap(s=>keys.map(k=>s[k]*scale));let low=Math.min(0,...values),high=Math.max(0,...values);if(high-low<1e-9){low-=1;high+=1;}const pad=(high-low)*.1;low-=pad;high+=pad;
 const x=time=>64+time/samples.at(-1).time*746,y=value=>244-(value-low)/(high-low)*212;
 const path=get=>preview.map((s,j)=>`${j?'L':'M'}${x(s.time).toFixed(2)},${y(get(s)*scale).toFixed(2)}`).join(' ');
 let html=`<title>${t(quantity==='current'?'circuit_currentPlot':'circuit_voltagePlot')}</title><desc>${t('circuit_chartDescription')}</desc>`;
 for(let j=0;j<=5;j++){const value=low+(high-low)*j/5,time=samples.at(-1).time*j/5;html+=`<path d="M64 ${y(value)}H810" stroke="#8fa8b8" stroke-width=".4"/><text x="57" y="${y(value)+3}" text-anchor="end">${fmt(value,3)}</text><text x="${x(time)}" y="264" text-anchor="middle">${fmt(time*1000,3)}</text>`;}
 html+=`<path d="M64 32V244H810" fill="none" stroke="currentColor" stroke-width=".8"/><text transform="translate(15 138) rotate(-90)" text-anchor="middle">${unit}</text><text x="437" y="290" text-anchor="middle">${t('timeAxis')}</text>`;
 for(const key of keys)html+=`<path d="${path(s=>s[key])}" stroke="${colors[key]}" stroke-width="2" fill="none" ${key==='source'?'stroke-dasharray="7 5"':''}/>`;
 const top=result.parameters.topology,primary=quantity==='voltage'?(top==='rl'?'vL':'vc'):(top==='rc'?'iC':'il');
 if(showAnalytical&&visible.has(primary)){
  const exact=s=>quantity==='voltage'?(top==='rl'?s.source-result.parameters.resistance*s.exactIL:s.exactVC):(top==='rc'?(s.source-s.exactVC)/result.parameters.resistance:s.exactIL);
  html+=`<path d="${path(exact)}" stroke="#db785e" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/>`;
 }
 if(!keys.length)html+=`<text x="437" y="140" text-anchor="middle">${t('circuit_noTraces')}</text>`;
 html+='<g class="probe"></g>';svg.innerHTML=html;
 return {x,y,scale,keys};
}
export function probe(svg,geometry,sample){
 svg.querySelector('.probe').innerHTML=`<path d="M${geometry.x(sample.time)} 32V244" stroke="#7696ac" stroke-dasharray="3 4"/>`+geometry.keys.map(key=>`<circle cx="${geometry.x(sample.time)}" cy="${geometry.y(sample[key]*geometry.scale)}" r="3" fill="${colors[key]}" stroke="white" stroke-width="1"/>`).join('');
}
export function imageBlob(svgs,title){
 const ns='http://www.w3.org/2000/svg',root=document.createElementNS(ns,'svg');root.setAttribute('viewBox','0 0 840 660');root.setAttribute('width','1680');root.setAttribute('height','1320');root.setAttribute('xmlns',ns);
 const background=document.createElementNS(ns,'rect');background.setAttribute('width','840');background.setAttribute('height','660');background.setAttribute('fill','white');root.append(background);
 const heading=document.createElementNS(ns,'text');heading.setAttribute('x','35');heading.setAttribute('y','25');heading.textContent=title;root.append(heading);
 const style=document.createElementNS(ns,'style');style.textContent='text{font:11px Segoe UI,Arial,sans-serif;fill:#172f43}svg{color:#172f43}';root.append(style);
 svgs.forEach((svg,j)=>{const copy=svg.cloneNode(true);copy.removeAttribute('id');copy.setAttribute('width','840');copy.setAttribute('height','300');copy.setAttribute('x','0');copy.setAttribute('y',String(45+j*305));copy.style.color='#172f43';root.append(copy);});
 return new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml;charset=utf-8'});
}
