/** Passive sign convention: series current clockwise; parallel currents downward. */
export function diagram(topology){
 const start='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 210" role="img" aria-label="'+topology.toUpperCase()+'"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
 const source='<circle cx="40" cy="105" r="22"/><path d="M40 83V40H80M40 127V175H310V150M34 98h12m-6-6v12m-6 11h12"/>';
 const R='<path d="M80 40h15l6-8 10 16 10-16 10 16 6-8h18"/>';
 const L='<path d="M155 40h10q8-26 16 0q8-26 16 0q8-26 16 0h20"/>';
 const C='<path d="M310 70v25m-17 0h34m-34 13h34m-17 0v42"/>';
 let wires,labels;
 if(topology==='parallel'){
  wires='<circle cx="40" cy="105" r="22"/><path d="M40 83V40H310V80M40 127V175H310V120M40 117V93m-5 6 5-6 5 6M130 40v30l-8 6 16 10-16 10 16 10-16 10 8 6v53M220 40v37q26 7 0 14q26 7 0 14q26 7 0 14v56M296 80h28m-28 12h28m-14 0v28M100 40v24m-4-5 4 5 4-5m86-19v24m-4-5 4 5 4-5m90-19v24m-4-5 4 5 4-5"/>';
  labels='<text x="12" y="150">Iₛ</text><text x="147" y="110">R</text><text x="238" y="110">L</text><text x="326" y="105">C</text><text x="80" y="69">iR</text><text x="171" y="69">iL</text><text x="263" y="69">iC</text><text x="318" y="27">+ v −</text>';
 }else{
  wires=source+R+(topology==='rl'?L+'<path d="M233 40H310V150"/>':topology==='series'?L+'<path d="M233 40H310V70"/>'+C:'<path d="M155 40H310V70"/>'+C)+'<path d="M68 18h65m-6-4 6 4-6 4"/>';
  labels='<text x="14" y="150">Vₛ</text><text x="106" y="70">R</text><text x="88" y="12">i →</text>'+(topology==='rc'?'<text x="325" y="107">C</text><text x="281" y="88">+</text><text x="281" y="126">−</text>':'<text x="188" y="70">L</text>')+(topology==='series'?'<text x="325" y="107">C</text><text x="281" y="88">+</text><text x="281" y="126">−</text>':'');
 }
 return start+wires+'</g><g>'+labels+'</g></svg>';
}
