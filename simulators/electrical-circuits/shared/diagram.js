/** Passive sign convention: series current clockwise; parallel currents downward. */
export function diagram(topology){
 const start='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 210" role="img" aria-label="'+topology.toUpperCase()+'"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
 const m=(x,y,tex,w=34)=>`<foreignObject x="${x}" y="${Math.max(0,y-16)}" width="${w}" height="28"><span xmlns="http://www.w3.org/1999/xhtml" data-latex="${tex}" style="font-size:12px;color:inherit"></span></foreignObject>`;
 const source='<circle cx="40" cy="105" r="22"/><path d="M40 83V40H80M40 127V175H310V150M34 98h12m-6-6v12m-6 11h12"/>';
 const R='<path d="M80 40h15l6-8 10 16 10-16 10 16 6-8h18"/>';
 const L='<path d="M155 40h10q8-26 16 0q8-26 16 0q8-26 16 0h20"/>';
 const C='<path d="M310 70v25m-17 0h34m-34 13h34m-17 0v42"/>';
 let wires,labels;
 if(topology==='parallel'){
  wires='<circle cx="40" cy="105" r="22"/><path d="M40 83V40H310V80M40 127V175H310V120M40 117V93m-5 6 5-6 5 6M130 40v30l-8 6 16 10-16 10 16 10-16 10 8 6v53M220 40v37q26 7 0 14q26 7 0 14q26 7 0 14v56M296 80h28m-28 12h28m-14 0v28M100 40v24m-4-5 4 5 4-5m86-19v24m-4-5 4 5 4-5m90-19v24m-4-5 4 5 4-5"/>';
  labels=m(12,150,String.raw`I_s`)+m(147,110,String.raw`R`)+m(238,110,String.raw`L`)+m(326,105,String.raw`C`)+m(80,69,String.raw`i_R`,30)+m(171,69,String.raw`i_L`,30)+m(263,69,String.raw`i_C`,30)+m(318,27,String.raw`+\;v\;-`,42);
 }else{
  wires=source+R+(topology==='rl'?L+'<path d="M233 40H310V150"/>':topology==='series'?L+'<path d="M233 40H310V70"/>'+C:'<path d="M155 40H310V70"/>'+C)+'<path d="M68 18h65m-6-4 6 4-6 4"/>';
  labels=m(14,150,String.raw`V_s`)+m(106,70,String.raw`R`)+m(88,12,String.raw`i\;\to`,40)+(topology==='rc'?m(325,107,String.raw`C`)+m(281,88,String.raw`+`)+m(281,126,String.raw`-`):m(188,70,String.raw`L`))+(topology==='series'?m(325,107,String.raw`C`)+m(281,88,String.raw`+`)+m(281,126,String.raw`-`):'');
 }
 return start+wires+'</g><g>'+labels+'</g></svg>';
}
