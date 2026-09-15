export const BANNON_RETARGET_CONTRACT = {
  version: 1,
  sourceSkeleton: 'Bannon canonical skinned GLB',
  identityBy: 'roster-id',
  boneMatch: 'normalized-bone-name',
  forbidPartNameBinding: true,
  forbidProceduralFallback: true,
  requiredRestPose: true,
  requiredSingleSkin: true,
  rootBoneCandidates: ['mixamorigHips','Hips','hips'],
  criticalChains: [
    ['hips','spine','spine1','spine2','neck','head'],
    ['hips','leftupLeg','leftleg','leftfoot'],
    ['hips','rightupLeg','rightleg','rightfoot'],
    ['spine2','leftShoulder','leftArm','leftForeArm','leftHand'],
    ['spine2','rightShoulder','rightArm','rightForeArm','rightHand']
  ],
  failurePolicy: 'FAIL_CLOSED'
} as const;

export function normalizeBoneName(name: string): string {
  return name.toLowerCase().replace(/mixamorig[:._-]?/g,'').replace(/[^a-z0-9]/g,'');
}

export function buildBoneIndex(names: string[]) {
  const index = new Map<string,string>();
  for (const name of names) index.set(normalizeBoneName(name), name);
  return index;
}
