export type HandPoint={x:number;y:number};
interface GestureOptions {
 inspect:()=>void;select:()=>void;schedule?:(callback:()=>void,delay:number)=>unknown;cancelTimer?:(handle:unknown)=>void;
 canDrag?:()=>boolean;dragStart?:(point:HandPoint)=>void;dragMove?:(point:HandPoint)=>void;drop?:(point:HandPoint)=>void;dragCancel?:()=>void;
}
/** Long press inspects, horizontal touch scrolls, and an upward touch lifts a card. */
export class HandGesture {
 private origin:HandPoint|null=null;private last:HandPoint|null=null;private timer:unknown=null;private suppressClick=false;private dragging=false;private pointerType='';
 constructor(private options:GestureOptions){}
 get isDragging(){return this.dragging;}
 private clear(){if(this.timer!==null){(this.options.cancelTimer||((id)=>clearTimeout(id as ReturnType<typeof setTimeout>)))(this.timer);this.timer=null;}}
 start(point:HandPoint,pointerType:string){this.dispose();this.suppressClick=false;this.origin=this.last=point;this.pointerType=pointerType;if(pointerType==='touch'||pointerType==='pen')this.timer=(this.options.schedule||setTimeout)(()=>{this.timer=null;this.origin=null;this.suppressClick=true;this.options.inspect();},550);}
 move(point:HandPoint){this.last=point;if(this.dragging){this.options.dragMove?.(point);return;}if(!this.origin)return;const dx=point.x-this.origin.x,dy=point.y-this.origin.y;if(Math.hypot(dx,dy)<=12)return;this.clear();this.origin=null;this.suppressClick=true;const lifts=this.pointerType==='mouse'||dy< -12&&Math.abs(dy)>=Math.abs(dx);if(lifts&&this.options.canDrag?.()){this.dragging=true;this.options.dragStart?.(point);}}
 release(point=this.last){this.clear();this.origin=null;if(this.dragging){this.dragging=false;this.suppressClick=true;if(point)this.options.drop?.(point);}}
 cancel(){this.clear();this.origin=null;this.suppressClick=true;if(this.dragging){this.dragging=false;this.options.dragCancel?.();}}
 click(keyboard=false){if(this.suppressClick&&!keyboard){this.suppressClick=false;return false;}this.suppressClick=false;this.options.select();return true;}
 dispose(){this.clear();this.origin=null;if(this.dragging){this.dragging=false;this.options.dragCancel?.();}}
}
