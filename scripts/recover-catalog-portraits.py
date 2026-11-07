"""Keep source-linked remote portraits for files whose thumbnail generation is rate-limited.
Only downloaded files are added to the local ML reference bank.
"""
import urllib.request,urllib.parse,json,re,os
names={'skink':'Long-tailed_Skink_(Mabuya_longicaudata)_長尾南蜥2.jpg','bankor-toad':'Bufo_bankorensis.jpg','paddy-frog':'Fejervarya_limnocharis_(43659333105).jpg','hermit':'Coenobita_rugosus_(land_hermit_crab).jpg'}
q=urllib.parse.urlencode({'action':'query','format':'json','titles':'|'.join('File:'+f for f in names.values()),'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':640})
request=urllib.request.Request('https://commons.wikimedia.org/w/api.php?'+q,headers={'User-Agent':'EarthDex-Education/0.2 educational prototype'})
data=json.load(urllib.request.urlopen(request,timeout=30));media=json.load(open('src/media.json'));refs=json.load(open('.sites-runtime/references/manifest.json'))
for p in data['query']['pages'].values():
 id=next((id for id,f in names.items()if f.replace('_',' ')==p['title'][5:].replace('_',' ')),None)
 if not id or 'imageinfo'not in p:continue
 info=p['imageinfo'][0];m=info['extmetadata'];local=os.path.exists('public/media/'+id+'.jpg')
 item={'speciesId':id,'path':'.sites-runtime/references/'+id+'-main.jpg','source':'https://commons.wikimedia.org/wiki/'+urllib.parse.quote(p['title']),'artist':re.sub('<[^>]+>','',m.get('Artist',{}).get('value','See source')),'license':m['LicenseShortName']['value'],'licenseUrl':m.get('LicenseUrl',{}).get('value','')}
 media[id]={'image':'/media/'+id+'.jpg' if local else info.get('thumburl',info['url']),'artist':item['artist'],'source':item['source'],'license':item['license'],'licenseUrl':item['licenseUrl'],'evidence':'https://en.wikipedia.org/wiki/'+{'skink':'Eutropis_longicaudata','bankor-toad':'Bufo_bankorensis','paddy-frog':'Fejervarya_limnocharis','hermit':'Coenobita_rugosus'}[id]}
 if os.path.exists(item['path']) and not any(r['path']==item['path']for r in refs):refs.append(item)
 print(id,'local'if local else'remote portrait (not in reference bank)')
json.dump(refs,open('.sites-runtime/references/manifest.json','w'),ensure_ascii=False,indent=2);json.dump(media,open('src/media.json','w'),ensure_ascii=False,indent=2)
