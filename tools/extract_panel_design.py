"""Genera src/checkout/design-data.js a partir de docs/fuentes/paneles/paneles-exp-meta.svg (el diseno del equipo).
Extrae el patron de triangulos, los degradados y los trazos (halo, chulo, flecha y hoja) de cada panel.
Uso: python3 tools/extract_panel_design.py   (los textos y las medidas se mantienen a mano en la plantilla de abajo)
"""
import json
import re

svg = open('docs/fuentes/paneles/paneles-exp-meta.svg').read()
defs = svg[svg.index('</style>'):svg.index('</defs>')]
body = svg[svg.index('</defs>'):]
pattern = defs[defs.index('<pattern'):defs.index('</pattern>')]
polygons = [list(map(float, m.split())) for m in re.findall(r'<polygon[^>]*points="([^"]+)"', pattern)]
paths = [m.group(2) for m in re.finditer(r'<path class="(cls-(?:5|10|21|27))"[^>]*? d="([^"]+)"', body)]
# orden en el SVG: panel 1 -> halo, chulo, flecha; panel 2 -> halo, chulo, flecha, hoja
print(json.dumps({'triangulos': len(polygons), 'trazos': [len(p) for p in paths]}))
print('Las medidas y textos de src/checkout/design-data.js salen de los atributos del SVG (rect, text, tspan); '
      'si el diseno cambia, vuelve a copiar esos valores y los trazos impresos por este script.')
