"""Generate independent pvlib/SciPy data for the PV simulator (development only)."""
import json
from pathlib import Path
import pvlib
from pvlib.ivtools.sdm import fit_desoto
from pvlib.pvsystem import calcparams_desoto, singlediode, i_from_v
params, result = fit_desoto(41.5, 13.0, 49.5, 13.9, 13.9 * 0.045 / 100, 49.5 * -0.275 / 100, 72,
    init_guess={'a_0': 1.8, 'Io_0': 2e-11, 'Rs_0': .2, 'Rsh_0': 130})
cases=[]
for irradiance,temperature in [(1000,25),(400,25),(1000,60),(200,-10),(1400,100)]:
    args=calcparams_desoto(irradiance,temperature,params['alpha_sc'],params['a_ref'],params['I_L_ref'],params['I_o_ref'],params['R_sh_ref'],params['R_s'])
    values=singlediode(*args)
    voc=float(values['v_oc'])
    points=[{'v':voc*f,'i':float(i_from_v(voc*f,*args))} for f in [0,.25,.5,.75,.95,1]]
    cases.append({'irradiance':irradiance,'temperature':temperature,'isc':float(values['i_sc']),'voc':voc,'imp':float(values['i_mp']),'vmp':float(values['v_mp']),'pmp':float(values['p_mp']),'points':points})
out={'pvlib':pvlib.__version__,'fit':{k:float(params[k]) for k in ['I_L_ref','I_o_ref','R_s','R_sh_ref','a_ref']},'cases':cases}
Path('tests/fixtures/photovoltaic-pvlib.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
