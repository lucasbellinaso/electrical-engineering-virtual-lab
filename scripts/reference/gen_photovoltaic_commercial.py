"""Generate pvlib reference outputs for manufacturer datasheet examples."""
import json
from pathlib import Path
import numpy as np
import pvlib
from pvlib.ivtools.sdm import fit_desoto
from pvlib.pvsystem import calcparams_desoto, singlediode

examples={
 'trina440':dict(voc=52.2,isc=10.67,vmp=44.0,imp=10.01,alpha=0.04,beta=-0.24,cells=72),
 'jinko620':dict(voc=55.55,isc=14.25,vmp=45.79,imp=13.54,alpha=0.045,beta=-0.25,cells=78),
 'canadian400':dict(voc=36.8,isc=13.85,vmp=30.8,imp=12.99,alpha=0.05,beta=-0.26,cells=54)
}
result={}
for name,p in examples.items():
 a=p['voc']*.035
 fitted,_=fit_desoto(p['vmp'],p['imp'],p['voc'],p['isc'],p['isc']*p['alpha']/100,p['voc']*p['beta']/100,p['cells'],init_guess={'a_0':a,'Io_0':p['isc']*np.exp(-p['voc']/a),'Rs_0':.2,'Rsh_0':120})
 cases=[]
 for G,T in [(1000,25),(600,25),(1000,60)]:
  args=calcparams_desoto(G,T,fitted['alpha_sc'],fitted['a_ref'],fitted['I_L_ref'],fitted['I_o_ref'],fitted['R_sh_ref'],fitted['R_s'])
  v=singlediode(*args);cases.append({'irradiance':G,'temperature':T,**{k:float(v[key]) for k,key in [('voc','v_oc'),('isc','i_sc'),('vmp','v_mp'),('imp','i_mp'),('pmp','p_mp')]}})
 result[name]={'datasheet':p,'cases':cases}
Path('tests/fixtures/photovoltaic-commercial-pvlib.json').write_text(json.dumps({'pvlib':pvlib.__version__,'modules':result},indent=2)+'\n',encoding='utf-8')
