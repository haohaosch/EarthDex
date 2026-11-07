import urllib.request,urllib.parse,json,re,io,os,time
from PIL import Image,ImageOps
rows=json.load(open('engine/taiwan-data.json'));media=json.load(open('src/media.json'));refs=json.load(open('.sites-runtime/references/manifest.json'))
for s in rows:
 if s['id'] in media:continue
 print('Search missing taxon',s['id'],flush=True)
 params=urllib.parse.urlencode({'action':'query','format':'json','generator':'search','gsrsearch':'"'+s['latin']+'" filetype:bitmap','gsrnamespace':6,'gsrlimit':5,'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':640})
 try:
  data=json.load(urllib.request.urlopen('https://commons.wikimedia.org/w/api.php?'+params,timeout=30))
  collected=0
  for p in data.get('query',{}).get('pages',{}).values():
   if 'imageinfo'not in p:continue
   info=p['imageinfo'][0];m=info['extmetadata'];lic=m.get('LicenseShortName',{}).get('value','')
   if not(lic.startswith('CC BY')or lic=='CC0'or'public domain'in lic.lower()):continue
   name=p['title'][5:]
   if not name.lower().endswith(('.jpg','.jpeg')):continue
   try:
    with urllib.request.urlopen(info.get('thumburl',info['url']),timeout=30)as response:b=response.read()
    path='.sites-runtime/references/'+s['id']+'-search-'+str(collected)+'.jpg';img=ImageOps.exif_transpose(Image.open(io.BytesIO(b))).convert('RGB');img.thumbnail((640,640));img.save(path,quality=88)
    item={'speciesId':s['id'],'path':path,'source':'https://commons.wikimedia.org/wiki/'+urllib.parse.quote(p['title']),'artist':re.sub('<[^>]+>','',m.get('Artist',{}).get('value','See source')),'license':lic,'licenseUrl':m.get('LicenseUrl',{}).get('value','')};refs.append(item)
    if collected==0:
     img.thumbnail((600,600));img.save('public/media/'+s['id']+'.jpg',quality=80,optimize=True);media[s['id']]={'image':'/media/'+s['id']+'.jpg','artist':item['artist'],'license':lic,'licenseUrl':item['licenseUrl'],'source':item['source'],'evidence':'https://en.wikipedia.org/wiki/'+s['wiki'].replace(' ','_')}
    collected+=1
    if collected>=2:break
   except Exception as e:print('Image',s['id'],str(e),flush=True)
  print('Added',collected,flush=True)
 except Exception as e:print('Search failed',str(e),flush=True)
json.dump(refs,open('.sites-runtime/references/manifest.json','w'),ensure_ascii=False,indent=2);json.dump(media,open('src/media.json','w'),ensure_ascii=False,indent=2)
