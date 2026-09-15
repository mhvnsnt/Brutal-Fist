export interface BannonFighterProfile {
  id:string; name:string; dna:string; role:string; poise:number; hp:number; speed:number; strength:number; physicsScale:number; payback:string; manager:string; bio:string; model:string; attire?:string;
}

/** HARD BOUNDARY: playable Bannon fighters must have an actual GLB in Bannon/assets/models. */
export const BANNON_ROSTER: readonly BannonFighterProfile[] = [
  {id:'bannon',name:'Bannon',dna:'BANNON_V1_CORE',role:'Wrestler',poise:95,hp:10000,speed:85,strength:90,physicsScale:1.1,payback:'Beast Mode',manager:'None',bio:'The physical nucleus and absolute force of the Bannon Engine.',model:'BANNON.glb'},
  {id:'maime',name:'Maime',dna:'MAIME',role:'Wrestler',poise:85,hp:10000,speed:90,strength:78,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'MAIME.glb'},
  {id:'onyx',name:'Onyx',dna:'ONYX',role:'Wrestler',poise:90,hp:10000,speed:88,strength:86,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'ONYX.glb'},
  {id:'cain_elias',name:'Cain Elias',dna:'CAIN_ELIAS',role:'Wrestler',poise:92,hp:10000,speed:84,strength:91,physicsScale:1.05,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'CAIN_ELIAS_ring.glb',attire:'Ring'},
  {id:'stick_up',name:'Stick-Up',dna:'STICKUP',role:'Wrestler',poise:85,hp:10000,speed:87,strength:82,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'STICKUP.glb'},
  {id:'cipher',name:'Cipher',dna:'CIPHER',role:'Wrestler',poise:88,hp:10000,speed:93,strength:80,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'CIPHER.glb'},
  {id:'echo',name:'Echo',dna:'ECHO',role:'Wrestler',poise:86,hp:10000,speed:91,strength:79,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'ECHO.glb'},
  {id:'cody',name:'Cody',dna:'CODY',role:'Wrestler',poise:84,hp:10000,speed:86,strength:83,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'CODY_sober.glb',attire:'Sober'},
  {id:'hall_nighter',name:'Hall Nighter',dna:'HALL_NIGHTER',role:'Wrestler',poise:90,hp:10000,speed:82,strength:88,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'HALL_NIGHTER.glb'},
  {id:'static',name:'Static',dna:'STATIC',role:'Wrestler',poise:87,hp:10000,speed:89,strength:84,physicsScale:1,payback:'TBD',manager:'None',bio:'Bannon GLB-backed fighter.',model:'STATIC.glb'},
];

export const getBannonFighter=(id:string)=>BANNON_ROSTER.find(f=>f.id===id)??null;
