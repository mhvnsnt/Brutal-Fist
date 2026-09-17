import * as THREE from 'three';

export interface PoseSample {
  bone: string;
  frame: number;
  position: [number,number,number];
  quaternion: [number,number,number,number];
}

export function sampleCriticalPose(root: THREE.Object3D, frame=0): PoseSample[] {
  const out: PoseSample[]=[];
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!(o as THREE.Bone).isBone) return;
    const q=o.getWorldQuaternion(new THREE.Quaternion());
    const p=o.getWorldPosition(new THREE.Vector3());
    out.push({bone:o.name,frame,position:p.toArray(),quaternion:q.toArray()});
  });
  return out;
}

export function comparePose(a: PoseSample[], b: PoseSample[]) {
  const bm=new Map(b.map(x=>[x.bone,x]));
  return a.flatMap(x=>{
    const y=bm.get(x.bone); if(!y) return [];
    const pd=Math.hypot(x.position[0]-y.position[0],x.position[1]-y.position[1],x.position[2]-y.position[2]);
    const qd=Math.abs(THREE.MathUtils.radToDeg(x.quaternion[0]-y.quaternion[0]))+
      Math.abs(THREE.MathUtils.radToDeg(x.quaternion[1]-y.quaternion[1]))+
      Math.abs(THREE.MathUtils.radToDeg(x.quaternion[2]-y.quaternion[2]));
    return [{bone:x.bone,positionDelta:pd,rotationDeltaDegrees:qd}];
  });
}
