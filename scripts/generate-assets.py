"""Rebuild original EEVL SVG/PNG artwork. Requires Pillow only for PNG export.
This is a maintenance tool; the portal itself has no Python dependency.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
for folder in ['assets/branding', 'assets/icons', 'assets/images']:
    (ROOT / folder).mkdir(parents=True, exist_ok=True)
symbol = '<g fill="none" stroke="#258bc5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="8" width="84" height="84" rx="16"/><path d="M16 50 H26 L34 27 L47 73 L60 27 L68 50 H78"/><circle cx="16" cy="50" r="3" fill="#258bc5"/><circle cx="78" cy="50" r="3" fill="#258bc5"/></g>'
for name, width, content in [
    ('logo-icon.svg', 100, symbol), ('favicon.svg', 100, symbol),
    ('logo.svg', 320, symbol + '<text x="104" y="73" font-size="65" font-weight="700" letter-spacing="2" fill="#258bc5">EEVL</text>'),
    ('logo-full.svg', 690, symbol + '<text x="110" y="54" font-size="44" font-weight="700" letter-spacing="2" fill="#258bc5">EEVL</text><text x="112" y="80" font-size="19" fill="#258bc5">Electrical Engineering Virtual Lab</text>')]:
    (ROOT/'assets/branding'/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 100" font-family="Segoe UI,Arial,sans-serif">{content}</svg>',encoding='utf-8')
for size in [192,512]:
    scale = size * 4 / 100
    im = Image.new('RGB',(size*4,size*4),'#102e4a'); draw = ImageDraw.Draw(im)
    def box(values): return tuple(round(v*scale) for v in values)
    draw.rounded_rectangle(box((8,8,92,92)),radius=round(16*scale),outline='#78beee',width=round(3*scale))
    draw.line([box(p) for p in [(19,50),(29,50),(37,29),(49,71),(61,29),(69,50),(81,50)]], fill='#78beee',width=round(3*scale),joint='curve')
    for x in [19,81]: draw.ellipse(box((x-3,47,x+3,53)), fill='#78beee')
    im.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/f'assets/icons/icon-{size}.png')

grid = '<defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#d7e5ef" stroke-width=".6"/></pattern></defs><rect width="560" height="350" fill="#f4f9fc"/><rect width="560" height="350" fill="url(#grid)"/>'
control = '''<g fill="none" stroke="#377fae" stroke-width="1.6"><path d="M44 91H96M116 91H155M249 91H295M389 91H509M455 91V150H106V101"/><circle cx="106" cy="91" r="10"/><rect x="155" y="67" width="94" height="48" rx="5" fill="#e7f2fa"/><rect x="295" y="67" width="94" height="48" rx="5" fill="#fff"/><path d="m148 87 7 4-7 4m133-8 7 4-7 4m107-8 7 4-7 4"/></g><g fill="#3c6b8b" font-family="Segoe UI,Arial" font-size="14" text-anchor="middle"><text x="202" y="97">Gc(s)</text><text x="342" y="97">Gp(s)</text><text x="52" y="76" font-size="11">r(t)</text><text x="494" y="76" font-size="11">y(t)</text><text x="106" y="95" font-size="11">+</text><text x="127" y="141" font-size="11">−</text></g><path d="M50 282H510M50 190V282" fill="none" stroke="#9bb7ca"/><path d="M50 281H76V208H510" stroke="#99aebd" stroke-width="1.5" stroke-dasharray="5 5" fill="none"/><path d="M50 281H76C90 281 99 181 138 191S181 225 220 213 260 206 310 209 370 208 510 208" stroke="#258bc5" stroke-width="2.6" fill="none"/><g font-family="Consolas,monospace" font-size="9" fill="#7893a6"><text x="50" y="305">0</text><text x="489" y="305">t →</text><text x="54" y="180">y(t)</text></g>'''
(ROOT/'assets/images/control-lab.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 350">{grid}{control}</svg>',encoding='utf-8')
arts = {
 'siso': control,
 'buck': '<path d="M60 150H140M140 150l35-23m0 23H215q10-40 20 0q10-40 20 0q10-40 20 0H355V230H80V150M325 150v22m-20 0h40m-40 12h40m-20 0v46"/><circle cx="80" cy="180" r="19"/><path d="M80 168v24m-7-12h14"/><text x="170" y="105">S</text><text x="235" y="105">L</text><text x="360" y="190">R</text><text x="290" y="205">C</text>',
 'buck-step': '<path d="M60 260H510M60 100v160" stroke="#9bb7ca"/><path d="M70 230H230V130H500" stroke-dasharray="6 6"/><path d="M70 230H230C250 230 260 115 300 120S340 149 375 139 425 133 500 135" stroke-width="3"/><text x="100" y="105">D₁ → D₂</text>',
 'dab': '<rect x="65" y="115" width="75" height="110" rx="6"/><rect x="400" y="115" width="75" height="110" rx="6"/><path d="M140 140h65q20 0 20 20t-20 20q20 0 20 20H140m105-80v100m12-100v100m20-80q-20 0-20 20t20 20q-20 0-20 20h123M140 210h65m72-70h123"/><text x="82" y="177">H₁</text><text x="417" y="177">H₂</text><text x="214" y="95">n : 1</text>',
 'opamp': '<path d="M190 105v155l145-78zM80 140h110m-110 80h110m145-38h120m-45 0v90H120v-52"/><text x="202" y="146">−</text><text x="202" y="230">+</text><text x="346" y="160">vₒ</text>'
}
for name,art in arts.items():
    if name == 'siso': content=art
    else: content=f'<g fill="none" stroke="#4384b0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{art}</g>'
    (ROOT/f'assets/images/{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 350">{grid}<style>text{{font:18px Consolas,monospace;fill:#4384b0;stroke:none}}</style>{content}</svg>',encoding='utf-8')
print('Generated 4 branding SVGs, 6 illustrations and 2 PNG icons.')
