/** Manufacturer STC datasheet examples. Half-cell modules use an effective series count. */
export const modulePresets = Object.freeze({
  trina440: Object.freeze({name:'Trina Solar TSM-440 NEG9R.28',source:'https://static.trinasolar.com/sites/default/files/Datasheet_Vertex%20S%2B_NEG9R.28_EN_2024_A_S1_web.pdf',voc:52.2,isc:10.67,vmp:44.0,imp:10.01,alpha:0.04,beta:-0.24,cells:72}),
  jinko620: Object.freeze({name:'Jinko Solar JKM620N-78HL4',source:'https://www.jinkosolar.com/uploads/JKM610-630N-78HL4-%28V%29-F3-EN.pdf',voc:55.55,isc:14.25,vmp:45.79,imp:13.54,alpha:0.045,beta:-0.25,cells:78}),
  canadian400: Object.freeze({name:'Canadian Solar CS6R-400MS',source:'https://static.csisolar.com/wp-content/uploads/2024/04/03105558/CS-Datasheet-HiKu6All-Black_CS6R-MS_v2.31C25_EN-25y.pdf',voc:36.8,isc:13.85,vmp:30.8,imp:12.99,alpha:0.05,beta:-0.26,cells:54})
});
export const presetFields = Object.freeze(['voc','isc','vmp','imp','alpha','beta','cells']);
