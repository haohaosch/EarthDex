"""Refresh pinned, attributed Wikimedia species portraits. Not part of runtime."""
import urllib.request,urllib.parse,json,re,os,concurrent.futures
species={'deer':'Formosan sika deer','magpie':'Taiwan blue magpie','bear':'Formosan black bear','sparrow':'Eurasian tree sparrow','panda':'Red panda','kingfisher':'Common kingfisher','butterfly':'Papilio memnon','turtle':'Green sea turtle','cat':'Leopard cat','macaque':'Formosan rock macaque','egret':'Little egret','barbet':'Taiwan barbet'}
def get(url):
 return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'EarthDexDemo/0.1 (educational noncommercial prototype)'}),timeout=40)
def run(item):
 id,title=item
 try:
  qs=urllib.parse.urlencode({'action':'query','format':'json','prop':'pageimages','piprop':'thumbnail|name','pithumbsize':800,'titles':title})
  page=next(iter(json.load(get('https://en.wikipedia.org/w/api.php?'+qs))['query']['pages'].values()))
  file=page['pageimage'];url=page['thumbnail']['source'].split('?')[0]
  qs=urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo','iiprop':'extmetadata','titles':'File:'+file})
  meta=next(iter(json.load(get('https://commons.wikimedia.org/w/api.php?'+qs))['query']['pages'].values()))['imageinfo'][0]['extmetadata']
  clean=lambda x:re.sub('<[^>]+>','',x)
  result={'id':id,'image':'/media/'+id+'.jpg','artist':clean(meta.get('Artist',{}).get('value','See source')),'license':meta.get('LicenseShortName',{}).get('value','See source'),'licenseUrl':meta.get('LicenseUrl',{}).get('value',''),'source':'https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(file),'evidence':'https://en.wikipedia.org/wiki/'+title.replace(' ','_')}
  with open('public/media/'+id+'.jpg','wb') as out:out.write(get(url).read())
  return result
 except Exception as e:print(id,str(e));return None
os.makedirs('public/media',exist_ok=True)
existing=json.load(open('src/media.json')) if os.path.exists('src/media.json') else {}
results=list(existing.values())
for item in species.items():
 if item[0] not in existing: results.append(run(item))
with open('src/media.json','w') as out:json.dump({x['id']:x for x in results if x},out,ensure_ascii=False,indent=2)
print('Saved',sum(bool(x) for x in results),'portraits with credits')
