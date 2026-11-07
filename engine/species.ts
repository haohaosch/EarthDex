import {generateCard} from './engine';
import taiwanData from './taiwan-data.json';
export interface Species {id:string;name:string;latin:string;group:string;habitat:string;region:string;tags:string[];sensitive:boolean;description:string;fact:string;questions:{q:string;options:string[];answer:number;explanation:string}[]}
const make=(id:string,name:string,latin:string,group:string,habitat:string,region:string,tags:string[],sensitive:boolean,description:string,fact:string,q:string,options:string[],answer:number):Species=>({id,name,latin,group,habitat,region,tags,sensitive,description,fact,questions:[{q,options,answer,explanation:fact},{q:`觀察${name}時，哪個行為最合適？`,options:['保持距離，安靜觀察','餵食以便拍照','靠近並觸摸牠','播放聲音吸引牠'],answer:0,explanation:'保持距離，不餵食、不追趕、不觸摸，讓動物保有自然行為。'}]});
export const SPECIES:Species[]=[
 make('deer','臺灣梅花鹿','Cervus nippon taiouanus','哺乳類','森林與草原','臺灣',[],false,'斑點像灑落林間的陽光。梅花鹿以植物為食，經復育後，再次在臺灣的野外棲地留下足跡。','梅花鹿是草食動物，主要取食草、嫩葉與枝條。','梅花鹿主要吃什麼？',['草、嫩葉與枝條','小型魚類','其他哺乳動物','昆蟲'],0),
 make('magpie','臺灣藍鵲','Urocissa caerulea','鳥類','低海拔森林','臺灣',['SOCIAL'],false,'長長的尾羽劃過樹梢，響亮的叫聲迴盪山林。這種臺灣特有鳥類經常成群活動，也會合作照顧幼鳥。','臺灣藍鵲具有合作育雛的行為，群體成員會協助照顧幼鳥。','臺灣藍鵲的哪種行為展現群體合作？',['合作照顧幼鳥','冬眠','築造水壩','長距離洄游'],0),
 make('sparrow','麻雀','Passer montanus','鳥類','聚落與農地','臺灣',['SOCIAL'],false,'在屋簷、田埂與樹梢間，最熟悉的鄰居也藏著值得觀察的細節。留意牠臉頰上的黑色斑塊。','麻雀常在聚落與農地活動，臉頰上的黑斑是辨識線索之一。','辨識麻雀時，可以注意哪個特徵？',['臉頰的黑色斑塊','鮮紅色的長尾','透明的翅膀','背上的硬殼'],0),
 make('butterfly','大鳳蝶','Papilio memnon','昆蟲','林緣與花園','臺灣',[],false,'一雙深色翅膀，在花間緩緩展開。雌雄外觀可能不同，幼蟲常取食芸香科植物。','大鳳蝶幼蟲常以柑橘等芸香科植物為食。','大鳳蝶幼蟲常取食哪一類植物？',['柑橘等芸香科植物','海藻','松樹樹皮','食蟲植物'],0),
 make('egret','小白鷺','Egretta garzetta','鳥類','濕地與溪流','臺灣',[],false,'白色身影佇立水邊，細長的黑腿與黃色腳掌，陪牠在淺水中尋覓食物。','小白鷺常在濕地淺水區捕食魚類等小動物。','哪裡最適合安靜觀察小白鷺覓食？',['濕地淺水區','高山冰川','沙漠腹地','深海海床'],0),
 make('kingfisher','翠鳥','Alcedo atthis','鳥類','溪流與池塘','臺灣',['AMBUSH'],false,'一抹藍綠色的閃光掠過水面。牠常停在水邊枝頭，等待機會俯衝捕魚。','翠鳥常從水邊棲枝俯衝入水，捕捉小魚。','翠鳥如何捕捉水中的小魚？',['從棲枝俯衝入水','以樹葉設陷阱','潛入深海數小時','用長舌黏住'],0),
 make('bear','臺灣黑熊','Ursus thibetanus formosanus','哺乳類','中高海拔森林','臺灣',[],true,'胸前的白色 V 字，是這位山林居民醒目的印記。牠的生存仰賴完整森林，也需要我們給予空間。','臺灣黑熊是雜食動物，胸前常有白色 V 字形斑紋。','臺灣黑熊胸前常見什麼斑紋？',['白色 V 字形','橘色圓點','藍色條紋','黑白棋盤格'],0),
 make('turtle','綠蠵龜','Chelonia mydas','爬蟲類','海洋與沙灘','臺灣',['ARMOR'],true,'越過珊瑚礁與廣闊海洋，回到沙灘繁衍下一代。保持距離，讓牠的每一口呼吸不被打擾。','綠蠵龜是海生爬蟲類，用肺呼吸，需要浮上海面換氣。','綠蠵龜為什麼需要浮上海面？',['用肺呼吸換氣','曬乾羽毛','採集花蜜','尋找淡水植物'],0),
 make('cat','石虎','Prionailurus bengalensis','哺乳類','低海拔淺山','臺灣',['CAMOUFLAGE','AMBUSH'],true,'低海拔淺山的夜行身影，身上的斑紋讓牠融入草叢。道路與棲地破碎化是牠面臨的挑戰。','石虎多在夜間活動，保護連通的淺山棲地有助於牠們生存。','哪種作法有助於石虎保育？',['維護棲地連通性','公開巢穴精確座標','餵食引誘拍照','將野生個體帶回家'],0),
 make('macaque','臺灣獼猴','Macaca cyclopis','哺乳類','森林與山地','臺灣',['SOCIAL'],false,'靈巧穿梭於山林，群體之間有豐富的互動。觀察時收好食物，尊重牠們的自然生活。','臺灣獼猴是群居動物；餵食會改變行為，也可能增加人猴衝突。','遇見臺灣獼猴時應該怎麼做？',['收好食物，保持距離','拿食物逗弄','直視並大聲吆喝','觸摸幼猴'],0),
 make('barbet','五色鳥','Psilopogon nuchalis','鳥類','低海拔闊葉林','臺灣',[],false,'像木魚般的叫聲，從綠色樹冠傳來。牠的綠色羽毛與繽紛頭部，是臺灣森林的調色盤。','五色鳥會在樹幹上鑿洞築巢，是臺灣特有鳥類。','五色鳥通常在哪裡築巢？',['樹幹的洞穴中','海底珊瑚中','沙漠沙丘下','瀑布水簾裡'],0),
 make('panda','小貓熊','Ailurus fulgens','哺乳類','溫帶山地森林','喜馬拉雅',[],true,'蓬鬆的環紋尾巴，在霧氣繚繞的山林保持平衡。牠以竹葉為主食，卻不屬於大貓熊的熊科。','小貓熊主要取食竹葉，屬於小貓熊科。','小貓熊主要取食什麼？',['竹葉','珊瑚','海魚','螞蟻'],0)
, ...taiwanData.map(s=>make(s.id,s.name,s.latin,s.group,s.habitat,'臺灣',s.tags,['cobra','civet','mongoose','owl'].includes(s.id),s.fact+' 在臺灣的合適棲地也有機會觀察到牠；請保持安全距離。',s.fact,`關於${s.name}，哪個敘述正確？`,[s.fact,'為了拍照，可以直接餵食或抓取牠','每個個體都只在深海生活','看到牠就應該帶離原本的棲地'],0))
];
export const speciesById=(id:string)=>{const s=SPECIES.find(s=>s.id===id);if(!s)throw Error('未知物種');return s;};
export const definition=(id:string)=>generateCard(id,speciesById(id).tags);
export const SERIES=[{id:'taiwan',name:'島嶼的鄰居',subtitle:'TAIWAN COLLECTION',description:'從城市到山林，重新認識這座島上的生命。',ids:SPECIES.filter(s=>s.region==='臺灣').map(s=>s.id),color:'#e5ecdf',icon:'island'}, {id:'birds',name:'聽見羽翼的聲音',subtitle:'BIRDS OF TAIWAN',description:'抬頭看看，那些陪伴我們的自由身影。',ids:SPECIES.filter(s=>s.group==='鳥類').map(s=>s.id),color:'#e4edf0',icon:'bird'}, {id:'forest',name:'走進綠色深處',subtitle:'FOREST EXPLORERS',description:'沿著林間小徑，遇見森林的守護者。',ids:['deer','magpie','bear','cat','macaque','barbet','squirrel','civet','muntjac','owl'],color:'#eee8dd',icon:'tree'}];
