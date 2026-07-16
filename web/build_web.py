#!/usr/bin/env python3
"""Generate web/index.html = the built game + PWA plumbing baked into <head>.
Run after every new game build:  python3 web/build_web.py
Then commit web/ and push; Cloudflare Pages redeploys automatically."""
import os
HERE=os.path.dirname(os.path.abspath(__file__))
GAME=os.path.join(HERE,"..","game","culinary-dash.html")
OUT=os.path.join(HERE,"index.html")
INJECT="""
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#2c2234">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icon-180.png">
<script>
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(e){console.warn('SW register failed:',e);});});}
</script>
"""
html=open(GAME,encoding="utf-8").read()
i=html.lower().find("</head>")
html=(html[:i]+INJECT+html[i:]) if i!=-1 else INJECT+html
open(OUT,"w",encoding="utf-8").write(html)
print("wrote web/index.html (%d bytes) with PWA plumbing baked in"%len(html))
