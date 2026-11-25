"""Reproduce integration copies without touching supplied files or numerical code."""
from pathlib import Path
import hashlib, json, re
root = Path(__file__).resolve().parents[1]
entries = [
 ('siso-design','Control Systems/SisoApp - projeto de controladores.html','control-systems/siso'),
 ('buck-steady','Power Electronics/simulador_buck.html','power-electronics/buck'),
 ('dab-battery','Power Electronics/dab_dinamico.html','power-electronics/dab'),
 ('opamp-lab','Fundamental Eletronics and Electrical Circuits/laboratorio_ampop.html','analog-electronics/opamp'),
 ('buck-pid','Control Systems/Buck com PID.html','control-systems/buck-pid')
]
head = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102e4a"><title>EEVL Laboratory</title><link rel="icon" href="../../../assets/branding/favicon.svg"><link rel="stylesheet" href="../../../assets/css/main.css"><script type="module" src="../../../assets/js/lab.js"></script></head>'''
header = '''<a class="skip" href="#main" data-i18n="skip">Skip to content</a><header class="sim-header"><a class="brand" href="../../../index.html"><img src="../../../assets/branding/logo-icon.svg" width="36" height="36" alt=""><span>EEVL</span></a><a class="back" href="../../../index.html#catalog" data-i18n="back">← Back to the catalog</a><div class="preferences"><select id="language" data-i18n-aria="language" aria-label="Language"><option value="en">EN</option><option value="pt-BR">PT-BR</option></select><select id="theme" data-i18n-aria="theme" aria-label="Theme"><option value="auto" data-i18n="auto">Auto</option><option value="light" data-i18n="light">Light</option><option value="dark" data-i18n="dark">Dark</option></select></div></header>'''
provenance = {'files':[], 'logoSource':'logoEEVL.svg','logoSourceSha256':hashlib.sha256((root/'logoEEVL.svg').read_bytes()).hexdigest(),'plotlySha256':hashlib.sha256((root/'assets/vendor/plotly-2.35.2.min.js').read_bytes()).hexdigest()}
for id, source, folder in entries:
    original=(root/source).read_bytes(); integrated=original; changes=[]
    if id=='siso-design':
        old=b'https://cdn.plot.ly/plotly-2.35.2.min.js'
        assert integrated.count(old)==1
        integrated=integrated.replace(old,b'../../../assets/vendor/plotly-2.35.2.min.js')
        changes.append('Plotly 2.35.2 CDN URL replaced with the local same-version copy.')
    if id=='buck-pid':
        integrated=re.sub(rb'<link[^>]+href="https://fonts\.googleapis\.com[^>]+>\r?\n?',b'',integrated)
        changes.append('Removed two external Google Fonts link tags; existing CSS font fallback applies.')
    target=root/'simulators'/folder;target.mkdir(parents=True,exist_ok=True)
    (target/'app.html').write_bytes(integrated)
    html=head+f'<body data-simulator="{id}">'+header+'''<main id="main" class="sim-wrapper"><div class="eyebrow" id="lab-category"></div><h1 id="lab-title"></h1><p id="lab-description"></p><p class="notice" data-i18n="originalNotice"></p><div class="actions"><a class="button primary" href="./app.html" data-i18n="fullscreen">Open full page ↗</a><a class="button" href="../../../docs/INTEGRATION.md" data-i18n="integrationNotes">Integration notes</a></div><p id="lab-metadata"></p><iframe class="legacy-frame" src="./app.html" title="Original simulator · Português" allow="clipboard-write" loading="eager"></iframe><section class="sim-docs"><h2 data-i18n="limitations"></h2><p data-i18n="legacyLimitations"></p><h2 data-i18n="references"></h2><p id="lab-references"></p></section></main><div class="update-bar" id="update" hidden role="status"><span data-i18n="updateReady"></span><button id="update-button" data-i18n="update"></button></div></body></html>'''
    (target/'index.html').write_text(html,encoding='utf-8')
    provenance['files'].append({'id':id,'source':source,'sourceSha256':hashlib.sha256(original).hexdigest(),'integrated':(target/'app.html').relative_to(root).as_posix(),'integratedSha256':hashlib.sha256(integrated).hexdigest(),'changes':changes})
(root/'docs/provenance.json').write_text(json.dumps(provenance,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(f'Integrated {len(entries)} supplied simulators; originals preserved.')
