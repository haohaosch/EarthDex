type Point={x:number;y:number};
interface GestureOptions {inspect:()=>void;select:()=>void;schedule?:(callback:()=>void,delay:number)=>unknown;cancelTimer?:(handle:unknown)=>void}
/** Keep a long press and a scrolling gesture from also selecting the card. */
export class HandGesture {
 private origin:Point|null=null;private timer:unknown=null;private suppressClick=false;
 constructor(private options:GestureOptions){}
 private clear(){if(this.timer!==null){(this.options.cancelTimer||((id)=>clearTimeout(id as ReturnType<typeof setTimeout>)))(this.timer);this.timer=null;}}
 start(point:Point,pointerType:string){this.clear();this.suppressClick=false;this.origin=point;if(pointerType==='touch'||pointerType==='pen')this.timer=(this.options.schedule||setTimeout)(()=>{this.timer=null;this.suppressClick=true;this.options.inspect();},550);}
 move(point:Point){if(this.origin&&Math.hypot(point.x-this.origin.x,point.y-this.origin.y)>10){this.clear();this.origin=null;this.suppressClick=true;}}
 release(){this.clear();this.origin=null;}
 cancel(){this.release();this.suppressClick=true;}
 click(keyboard=false){if(this.suppressClick&&!keyboard){this.suppressClick=false;return false;}this.suppressClick=false;this.options.select();return true;}
 dispose(){this.clear();this.origin=null;}
}
