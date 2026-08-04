#!/usr/bin/env python3
"""
Minimales Skript für seitliche Kamera + Hitzeeffekte bei Landung.
"""

def main():
    file_path = '/root/bayerische-kartenspiele/space-explorer-3d.html'
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_braces = (content.count('{'), content.count('}'))
    print(f"Original: {original_braces[0]} {{, {original_braces[1]} }}")
    
    # 1. State-Variablen für neue Effekte
    content = content.replace(
        "seqState: 0, // 0=idle, 1=approach, 2=descent, 3=flare/touchdown, 4=landed, 5=liftoff, 6=climb",
        "seqState: 0, // 0=idle, 1=atmo entry, 2=approach, 3=descent, 4=flare, 5=landed, 6=liftoff, 7=climb"
    )
    content = content.replace(
        "seqStartVel: null,",
        "seqStartVel: null, seqLandingNormal: null, inAtmosphere: false, heatIntensity: 0, cameraShakeIntensity: 0,"
    )
    
    # 2. Hitzeeffekte nach Dust-Partikeln
    dust_end = content.find('// Store for animation\nconst dustState = ')
    if dust_end != -1:
        dust_end = content.find('};', dust_end) + 2
        heat_code = '''

// Heat effects
const heatGlowGroup = new THREE.Group();
shipGroup.add(heatGlowGroup);
const heatGlow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), new THREE.MeshBasicMaterial({color: 0xff4400, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
heatGlowGroup.add(heatGlow);
const heatParticles = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({color: 0xff6600, size: 0.1, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false})
);
heatGlowGroup.add(heatParticles);
const hp = { pos: new Float32Array(40*3), vel: new Float32Array(40*3), count: 40 };
for(let i=0;i<40;i++){hp.pos[i*3]=0;hp.pos[i*3+1]=0;hp.pos[i*3+2]=0;hp.vel[i*3]=(Math.random()-0.5)*2;hp.vel[i*3+1]=(Math.random()-0.5)*2;hp.vel[i*3+2]=(Math.random()-0.5)*2;}
heatParticles.geometry.setAttribute('position', new THREE.BufferAttribute(hp.pos, 3));
function updateHeatEffects(delta){
  const i = state.heatIntensity;
  if(i<=0){heatGlow.material.opacity=0;heatParticles.material.opacity=0;return;}
  heatGlow.material.opacity=i*0.3;heatGlow.scale.set(1+i*0.5,1+i*0.3,1+i*0.5);
  for(let j=0;j<40;j++){
    if(Math.random()<i*0.1){hp.pos[j*3]=(Math.random()-0.5)*1.2;hp.pos[j*3+1]=(Math.random()-0.5)*0.6;hp.pos[j*3+2]=-1.5+Math.random()*0.5;hp.vel[j*3]=(Math.random()-0.5)*(2+i*3);hp.vel[j*3+1]=(Math.random()-0.5)*(1+i*2);hp.vel[j*3+2]=-1-Math.random()*(2+i*2);}
    hp.pos[j*3]+=hp.vel[j*3]*delta;hp.pos[j*3+1]+=hp.vel[j*3+1]*delta;hp.pos[j*3+2]+=hp.vel[j*3+2]*delta;
    if(hp.pos[j*3+2]<-3){hp.pos[j*3]=0;hp.pos[j*3+1]=0;hp.pos[j*3+2]=-100;}
  }
  heatParticles.geometry.attributes.position.needsUpdate=true;heatParticles.material.opacity=i*0.5;heatParticles.material.size=0.05+i*0.2;
}
function applyCameraShake(camera, intensity){if(intensity<=0)return;camera.position.x+=(Math.random()-0.5)*intensity*0.1;camera.position.y+=(Math.random()-0.5)*intensity*0.1;camera.position.z+=(Math.random()-0.5)*intensity*0.1;}
'''
        content = content[:dust_end] + heat_code + content[dust_end:]
    
    # 3. startLandingSequence: Phase 1 = Atmosphäreneintritt
    content = content.replace(
        "state.seqState = 1; // approach",
        "state.seqState = 1; // atmospheric entry"
    )
    content = content.replace(
        "state.seqLandingPos = landingPos.clone();",
        "state.seqLandingPos = landingPos.clone(); state.seqLandingNormal = landingNormal.clone(); state.inAtmosphere = true; state.heatIntensity = 0; state.cameraShakeIntensity = 0;"
    )
    
    # 4. updateLandingSequence: Neue Phasenlogik
    old_func = content[content.find('function updateLandingSequence(delta){'):content.find('function startLaunchSequence')]
    new_func = '''function updateLandingSequence(delta){
  const p = state.seqPlanet;
  if(!p) return;
  state.seqTimer += delta;
  if(state.seqState >= 1 && state.seqState <= 3) updateHeatEffects(delta);
  if(state.seqState === 1){// ATMOSPHERE ENTRY
    const t = Math.min(1, state.seqTimer / 2.5); const st = t * t;
    state.heatIntensity = Math.min(1, Math.sin(t * Math.PI) * 1.2); state.inAtmosphere = true;
    state.cameraShakeIntensity = (t > 0.2 && t < 0.8) ? state.heatIntensity * 0.3 : 0;
    const target = p.group.position.clone().add(state.seqLandingNormal.clone().multiplyScalar(p.data.size * 1.15));
    state.pos.lerpVectors(state.seqStartPos, target, st);
    state.pitch += (0.3 - state.pitch) * 0.05;
    state.yaw += (Math.atan2(p.group.position.x - state.pos.x, p.group.position.z - state.pos.z) - state.yaw) * 0.05;
    state.vel.multiplyScalar(0.92); state.speed = state.vel.length();
    document.getElementById('seqStatus').textContent='🔥 Atmosphäreneintritt';
    document.getElementById('nearHint').textContent='🌡️ Hitze: '+Math.round(state.heatIntensity*100)+'%';
    if(t>=1){state.seqState=2;state.seqTimer=0;state.seqStartPos=state.pos.clone();state.heatIntensity=0.5;document.getElementById('seqStatus').textContent='🎯 Anflug';}
  } else if(state.seqState === 2){// APPROACH
    const t = Math.min(1, state.seqTimer / 2.0); const st = t * t;
    state.heatIntensity = Math.max(0, state.heatIntensity - delta * 0.3);
    const target = state.seqLandingPos.clone().add(state.seqLandingNormal.clone().multiplyScalar(5));
    state.pos.lerpVectors(state.seqStartPos, target, st);
    state.pitch += (0.3 - state.pitch) * 0.05;
    state.yaw += (Math.atan2(p.group.position.x - state.pos.x, p.group.position.z - state.pos.z) - state.yaw) * 0.05;
    state.vel.multiplyScalar(0.95); state.speed = state.vel.length();
    document.getElementById('nearHint').textContent='🛸 Anflug: '+Math.round((1-st)*100)+'%';
    if(t>=1){state.seqState=3;state.seqTimer=0;state.seqStartPos=state.pos.clone();state.inAtmosphere=true;state.heatIntensity=0.3;document.getElementById('seqStatus').textContent='⬇️ Sinkflug';}
  } else if(state.seqState === 3){// DESCENT
    const duration = CFG.landing.descentDuration; const t = Math.min(1, state.seqTimer / duration); const st = t * t * (3 - 2 * t);
    const landingPos = state.seqLandingPos.clone(); const landingNormal = state.seqLandingNormal.clone();
    state.pos.lerpVectors(state.seqStartPos, landingPos, st);
    state.pitch += ( (1.0 - Math.min(0.8, t * t * 2.5)) * 1.2 - state.pitch ) * 0.08;
    state.yaw += Math.sin(state.seqTimer * 3) * 0.004;
    if(st > 0.5 && !legGroup.visible){legGroup.visible=true;legGroup.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), landingNormal));document.getElementById('seqStatus').textContent='🦿 Fahrwerk';setTimeout(()=>{document.getElementById('seqStatus').textContent='⬇️ Landen';},400);}
    if(st > 0.7){state.seqState=4;state.seqTimer=0;state.seqStartPos=state.pos.clone();document.getElementById('seqStatus').textContent='🔄 Abfangen';}
    const dist = state.pos.distanceTo(p.group.position); const h = Math.max(0, dist - getTerrainHeight(p, state.pos));
    document.getElementById('nearHint').textContent='🛸 '+Math.round(h*1000)+' m';
  } else if(state.seqState === 4){// FLARE + TOUCHDOWN
    const duration = 1.0; const t = Math.min(1, state.seqTimer / duration); const st = t * t * (3 - 2 * t);
    const landingPos = state.seqLandingPos.clone(); const landingNormal = state.seqLandingNormal.clone();
    state.pos.lerpVectors(state.seqStartPos, landingPos, st); state.pitch *= 0.9; if(Math.abs(state.pitch) < 0.05) state.pitch = 0;
    if(legGroup.visible) legGroup.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), landingNormal));
    if(st > 0.85){const vib = (1 - st) * 0.05; state.pos.x += (Math.random()-0.5) * vib; state.pos.z += (Math.random()-0.5) * vib; state.cameraShakeIntensity = (1 - st) * 0.5;}
    const dist = state.pos.distanceTo(p.group.position); const h = Math.max(0, dist - getTerrainHeight(p, state.pos)); const hm = Math.round(h*1000);
    document.getElementById('nearHint').textContent = hm < 100 ? '🛸 '+hm+' m - 🔥 LANDUNG!' : '🛸 '+hm+' m';
    if(t >= 1){
      const fd = p.group.position.clone().sub(state.pos).normalize();
      const fr = new THREE.Raycaster(); fr.set(state.pos.clone(), fd.negate());
      const fi = fr.intersectObject(p.mesh, true);
      let flp = landingPos.clone();
      if(fi.length>0) flp=fi[0].point.clone(); else { const d=state.pos.distanceTo(p.group.position); flp=p.group.position.clone().add(fd.clone().multiplyScalar(Math.max(p.data.size,d))); }
      state.pos.copy(flp); state.seqLandingPos=flp.clone();
      state.seqLandingNormal=fi.length>0&&fi[0].face?fi[0].face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(p.mesh.matrixWorld)):fd.clone();
      state.vel.set(0,0,0); state.speed=0; state.inAtmosphere=false; state.heatIntensity=0; state.cameraShakeIntensity=0.8;
      legGroup.visible=true; legGroup.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), landingNormal));
      emitDustBurst(landingPos.clone().add(landingNormal.clone().multiplyScalar(-0.1)), 45);
      state.seqState=5; state.landed=true; state.landedOn=p;
      document.getElementById('landBtn').textContent='🚀 Starten (Enter)'; document.getElementById('landBtn').className='show launch';
      document.getElementById('locName').textContent='🛸 '+p.data.name; document.getElementById('landPlanetName').textContent='🪐 '+p.data.name;
      document.getElementById('landedUI').classList.add('show'); document.getElementById('landingZone').classList.remove('show');
      document.getElementById('seqStatus').textContent='✅ Gelandet!'; document.getElementById('nearHint').textContent='–';
      setTimeout(()=>{document.getElementById('seqStatus').className='';},2000); closePlanetInfo();
    }
  }
}

'''
    content = content.replace(old_func, new_func)
    
    # 5. Kamera-Logik für Seitansicht
    cam_old = content[content.find('// ===== LANDING/LAUNCH SEQUENCE ACTIVE?'):content.find('// HUD')]
    cam_new = '''  // ===== LANDING/LAUNCH SEQUENCE ACTIVE? =====
  if(state.seqState >= 1 && state.seqState <= 5){
    updateLandingSequence(delta); updateDust(delta);
    shipGroup.position.copy(state.pos); shipGroup.rotation.set(state.pitch,state.yaw,0);
    applyCameraShake(camera, state.cameraShakeIntensity);
    if(state.seqState === 1){
      const sr = new THREE.Vector3(Math.sin(state.yaw + Math.PI/2), 0, Math.cos(state.yaw + Math.PI/2));
      const co = sr.clone().multiplyScalar(4).add(new THREE.Vector3(0, 1, 0));
      camera.position.lerp(state.pos.clone().add(co), 0.15);
      camera.lookAt(state.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    } else if(state.seqState === 2){
      const td=4; state.camDist+=(td-state.camDist)*0.08;
      const ho=new THREE.Vector3(0,state.camDist*0.4,state.camDist); ho.applyEuler(new THREE.Euler(0,state.yaw,0,'YXZ'));
      const cp=state.pos.clone().add(ho); cp.y+=1.5+state.camDist*0.08;
      camera.position.lerp(cp,0.15); camera.lookAt(state.pos.clone().add(new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(0,state.yaw,0,'YXZ')).multiplyScalar(3)));
    } else if(state.seqState === 3){
      const co = new THREE.Vector3(0, 0.8, 2); co.applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, 'YXZ'));
      camera.position.lerp(state.pos.clone().add(co), 0.15); camera.lookAt(state.pos.clone().add(new THREE.Vector3(0, 0, -3).applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, 'YXZ'))));
    } else if(state.seqState === 4){
      const sr = new THREE.Vector3(Math.sin(state.yaw + Math.PI/2), 0, Math.cos(state.yaw + Math.PI/2));
      const so = sr.clone().multiplyScalar(3);
      camera.position.lerp(state.pos.clone().add(so).add(new THREE.Vector3(0, 0.8, 0)), 0.2);
      camera.lookAt(state.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    }
    // HUD
'''
    content = content.replace(cam_old, cam_new)
    
    # 6. Flammeneffekte verstärken
    content = content.replace(
        'const flameI=state.landed?0.15:(isBoosting?1.0:0.2+speedNorm*0.8);',
        'const heatBoost = state.inAtmosphere ? 0.5 + state.heatIntensity * 0.5 : 0; const flameI=state.landed?0.15:(isBoosting?1.0:0.2+speedNorm*0.8+heatBoost);'
    )
    
    # 7. Launch-Phasen anpassen (5->6, 6->7)
    content = content.replace('state.seqState = 5; // liftoff', 'state.seqState = 6; // liftoff')
    content = content.replace('else if(state.seqState === 6){', 'else if(state.seqState === 7){')
    content = content.replace('if(state.seqState >= 5){', 'if(state.seqState >= 6 && state.seqState <= 7){')
    
    # 8. HUD: Geschwindigkeit + Höhe
    content = content.replace(
        "document.getElementById('speedVal').textContent=Math.round(state.speed*10)/10;",
        "if(state.seqState>=1&&state.seqState<=4&&state.seqPlanet){const h=state.pos.distanceTo(state.seqPlanet.group.position)-state.seqPlanet.data.size;document.getElementById('speedVal').textContent=Math.round(state.speed*10)/10+' / '+Math.round(Math.max(0,h)*1000)+'m';}else{document.getElementById('speedVal').textContent=Math.round(state.speed*10)/10;}"
    )
    
    # 9. Auto-Landung nur bei seqState 0
    content = content.replace(
        'if(nearDist < nearest.data.size + 3.5 && state.speed < CFG.landing.autoLandSpeed && !state.touchActive){',
        'if(nearDist < nearest.data.size + 3.5 && state.speed < CFG.landing.autoLandSpeed && !state.touchActive && state.seqState === 0){'
    )
    
    # Speichern
    with open(file_path, 'w') as f:
        f.write(content)
    
    new_braces = (content.count('{'), content.count('}'))
    print(f"Neu: {new_braces[0]} {{, {new_braces[1]} }}")
    print(f"Dateigröße: {len(content)} Zeichen")
    
    if new_braces[0] == new_braces[1]:
        print("✅ KLAMMERN OK - ALLE ÄNDERUNGEN ERFOLGREICH!")
    else:
        print(f"❌ KLAMMERN FEHLEN: {new_braces[0] - new_braces[1]}")

if __name__ == '__main__':
    main()
