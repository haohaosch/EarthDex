"""Build attributed Taiwan animal image exemplars; no private user images are used."""
import urllib.request,urllib.parse,json,os,re,time,io,hashlib
from PIL import Image,ImageOps
ROWS=json.load(open('engine/taiwan-data.json'))
original={'deer':('Formosan sika deer','Cervus nippon'),'magpie':('Taiwan blue magpie','Urocissa caerulea'),'bear':('Formosan black bear','Ursus thibetanus'),'sparrow':('Eurasian tree sparrow','Passer montanus'),'kingfisher':('Common kingfisher','Alcedo atthis'),'butterfly':('Papilio memnon','Papilio memnon'),'turtle':('Green sea turtle','Chelonia mydas'),'cat':('Leopard cat','Prionailurus bengalensis'),'macaque':('Formosan rock macaque','Macaca cyclopis'),'egret':('Little egret','Egretta garzetta'),'barbet':('Taiwan barbet','Psilopogon nuchalis')}
subjects=[{'id':k,'wiki':v[0],'latin':v[1]} for k,v in original.items()]+ROWS
agent={'User-Agent':'EarthDex-Education/0.2 (open-source educational field-guide prototype)'}
def get(url):
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=agent),timeout=35) as r:return r.read()
  except urllib.error.HTTPError as e:
   if e.code==429 and attempt<1:
    wait=min(20,int(e.headers.get('Retry-After','3')));print('Rate limit, retry in',wait,flush=True);time.sleep(wait)
   else:raise
  except Exception:
   if attempt==1:raise
   time.sleep(1)
def api(host,**args):return json.loads(get('https://'+host+'/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json',**args})))['query']['pages']
cache='.sites-runtime/references';os.makedirs(cache,exist_ok=True)
listing=cache+'/wiki-pages.json'
if os.path.exists(listing):pages=json.load(open(listing))
else:
 pages={}
 for start in range(0,len(subjects),12):
  subset=subjects[start:start+12]
  batch=api('en.wikipedia.org',titles='|'.join(s['wiki'] for s in subset),prop='pageimages|images',piprop='name',imlimit=200,redirects=1)
  pages.update({p['title']:p for p in batch.values()});print('Pages',len(pages),flush=True)
 json.dump(pages,open(listing,'w'))
bytitle={k.lower().replace('_',' '):v for k,v in pages.items()}
missing_subjects=[s for s in subjects if s['wiki'].lower() not in bytitle]
if missing_subjects:
 params=urllib.parse.urlencode({'action':'query','format':'json','titles':'|'.join(s['wiki'] for s in missing_subjects),'prop':'pageimages|images','piprop':'name','imlimit':200,'redirects':1})
 query=json.loads(get('https://en.wikipedia.org/w/api.php?'+params))['query']
 resolved={p['title']:p for p in query['pages'].values()}
 aliases={r['from']:r['to'] for r in query.get('redirects',[])}
 for subject in missing_subjects:
  title=subject['wiki'];target=title
  for _ in range(6):target=aliases.get(target,target)
  if target in resolved:bytitle[title.lower()]=resolved[target];pages[title]=resolved[target]
 json.dump(pages,open(listing,'w'))
allfiles=set();selected={}
banned=['.svg','.gif','range','map','distribution','logo','icon','commons','wikimedia','wikidata','signature','skeleton','fossil','egg','skull','sound','anatom','drawing','hatch','nest','habitat','chick','juvenile','larva','caterpillar','pupa','iucn',' area.','dentition','dental','diagram','logo','illustration','locations','gbif']
for s in subjects:
 page=bytitle.get(s['wiki'].lower())
 if not page:print('MISSING PAGE',s['id'],s['wiki'],flush=True);continue
 main=page.get('pageimage');files=[x['title'][5:] for x in page.get('images',[])]
 words=[x.lower() for x in s['latin'].split()]+[x.lower() for x in s['wiki'].replace('-',' ').replace("'",'').split() if len(x)>3]
 suitable=[f for f in files if f.lower().endswith(('.jpg','.jpeg','.png')) and not any(x in f.lower() for x in banned) and any(w in f.lower().replace('_',' ') for w in words)]
 choices=list({f.replace('_',' '):f for f in (([main] if main else [])+suitable) if not any(word in f.lower() for word in ['iucn',' area.','dentition','dental','diagram'])}.values())[:5]
 selected[s['id']]=choices;allfiles.update(choices)
metadatafile=cache+'/commons-info.json'
info=json.load(open(metadatafile)) if os.path.exists(metadatafile) else {}
missing=[f for f in allfiles if f not in info]
for start in range(0,len(missing),15):
 batch=api('commons.wikimedia.org',titles='|'.join('File:'+f for f in missing[start:start+15]),prop='imageinfo',iiprop='url|extmetadata|size',iiurlwidth=640)
 for p in batch.values():
  if 'imageinfo' in p:info[p['title'][5:].replace('_',' ')]=p['imageinfo'][0]
 json.dump(info,open(metadatafile,'w'));print('Metadata',len(info),flush=True)
media=json.load(open('src/media.json'));refs=json.load(open(cache+'/manifest.json')) if os.path.exists(cache+'/manifest.json') else []
done={r['speciesId'] for r in refs}
for subject in subjects:
 id=subject['id']
 if id in done:continue
 collected=[]
 for number,f in enumerate(selected.get(id,[])):
  meta=info.get(f.replace('_',' '));
  if not meta:continue
  m=meta.get('extmetadata',{});license=m.get('LicenseShortName',{}).get('value','');licenseurl=m.get('LicenseUrl',{}).get('value','')
  if not(license.startswith('CC BY') or 'public domain' in license.lower() or license=='CC0'):continue
  try:
   url=meta.get('thumburl',meta['url'])
   path=cache+'/'+id+'-'+str(number)+'.jpg'
   if not os.path.exists(path):
    image=ImageOps.exif_transpose(Image.open(io.BytesIO(get(url)))).convert('RGB');image.thumbnail((640,640));image.save(path,'JPEG',quality=88)
   item={'speciesId':id,'path':path,'source':'https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(f),'artist':re.sub('<[^>]+>','',m.get('Artist',{}).get('value','See source')),'license':license,'licenseUrl':licenseurl}
   collected.append(item)
   if len(collected)==1:
    img=Image.open(path);img.thumbnail((600,600));img.save('public/media/'+id+'.jpg',quality=80,optimize=True)
    media[id]={'image':'/media/'+id+'.jpg','artist':item['artist'],'license':license,'licenseUrl':licenseurl,'source':item['source'],'evidence':'https://en.wikipedia.org/wiki/'+subject['wiki'].replace(' ','_')}
   if len(collected)>=3:break
  except Exception as e:print('IMAGE FAILED',id,str(e),flush=True)
 refs.extend(collected);json.dump(refs,open(cache+'/manifest.json','w'),ensure_ascii=False,indent=2);json.dump(media,open('src/media.json','w'),ensure_ascii=False,indent=2)
 print(id,len(collected),'references',flush=True)
print('TOTAL',len(refs),'images',len(set(r['speciesId'] for r in refs)),'taxa')
