#!/usr/bin/env python3
"""
Skript zum Anpassen der space-explorer-3d.html Datei für verbesserte Landungserfahrung.
Änderungen:
1. Seitliche Kameraansicht während Atmosphäreneintritt und Landung
2. Hitzeeffekte (Glow + Partikel) während Atmosphäreneintritt
3. Verstärkte Flammeneffekte
4. Kamera-Shake für Realismus
5. UI-Anpassungen für Höhe und Geschwindigkeit
"""

def main():
    file_path = '/root/bayerische-kartenspiele/space-explorer-3d.html'
    
    # Lade die ursprüngliche Datei
    with open(file_path, 'r') as f:
        content = f.read()
    
    # 1. State-Variablen anpassen
    state_old = """  // 3D Landing sequence state machine
  seqState: 0, // 0=idle, 1=approach, 2=descent, 3=flare/touchdown, 4=landed, 5=liftoff, 6=climb
  seqPlanet: null,
  seqTimer: 0,
  seqStartPos: null,
  seqLandingPos: null,
  seqEndPos: null,
  seqStartVel: null,"""
    
    state_new = """  // 3D Landing sequence state machine
  seqState: 0, // 0=idle, 1=atmospheric entry, 2=approach, 3=descent, 4=flare/touchdown, 5=landed, 6=liftoff, 7=climb
  seqPlanet: null,
  seqTimer: 0,
  seqStartPos: null,
  seqLandingPos: null,
  seqEndPos: null,
  seqStartVel: null,
  seqLandingNormal: null,
  // Atmospheric entry effects
  inAtmosphere: false,
  heatIntensity: 0,
  // Camera state
  cameraShakeIntensity: 0,"""
    
    content = content.replace(state_old, state_new)
    
    # 2. Hitzeeffekte hinzufügen (nach Dust-Partikeln)
    dust_marker = '// Store for animation\nconst dustState = { positions: dustPos, velocities: dustVel, lifetimes: dustLife, count: dustCount, active: false };'
    dust_pos = content.find(dust_marker)
    if dust_pos != -1:
        heat_effects = """

// ===================== HEAT EFFECTS =====================
// Heat glow effect for atmospheric entry
const heatGlowGroup = new THREE.Group();
shipGroup.add(heatGlowGroup);
const heatGlowGeometry = new THREE.SphereGeometry(1.5, 16, 16);
const heatGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xff4400,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const heatGlow = new THREE.Mesh(heatGlowGeometry, heatGlowMaterial);
heatGlowGroup.add(heatGlow);

// Heat particles for atmospheric entry
const heatParticleCount = 40;
const heatParticleGeometry = new THREE.BufferGeometry();
const heatParticlePositions = new Float32Array(heatParticleCount * 3);
const heatParticleVelocities = new Float32Array(heatParticleCount * 3);
for (let i = 0; i < heatParticleCount; i++) {
  heatParticlePositions[i * 3] = 0;
  heatParticlePositions[i * 3 + 1] = 0;
  heatParticlePositions[i * 3 + 2] = 0;
  heatParticleVelocities[i * 3] = (Math.random() - 0.5) * 2;
  heatParticleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
  heatParticleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
}
heatParticleGeometry.setAttribute('position', new THREE.BufferAttribute(heatParticlePositions, 3));
const heatParticleMaterial = new THREE.PointsMaterial({
  color: 0xff6600,
  size: 0.1,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const heatParticles = new THREE.Points(heatParticleGeometry, heatParticleMaterial);
heatGlowGroup.add(heatParticles);

// Store heat particle state
const heatParticleState = {
  positions: heatParticlePositions,
  velocities: heatParticleVelocities,
  count: heatParticleCount
};

// Function to update heat effects
function updateHeatEffects(delta) {
  const intensity = state.heatIntensity;
  if (intensity <= 0) {
    heatGlowMaterial.opacity = 0;
    heatParticleMaterial.opacity = 0;
    return;
  }
  heatGlowMaterial.opacity = intensity * 0.3;
  heatGlow.scale.set(1 + intensity * 0.5, 1 + intensity * 0.3, 1 + intensity * 0.5);
  const pos = heatParticleState.positions;
  const vel = heatParticleState.velocities;
  for (let i = 0; i < heatParticleState.count; i++) {
    if (Math.random() < intensity * 0.1) {
      pos[i * 3] = (Math.random() - 0.5) * 1.2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      pos[i * 3 + 2] = -1.5 + Math.random() * 0.5;
      vel[i * 3] = (Math.random() - 0.5) * (2 + intensity * 3);
      vel[i * 3 + 1] = (Math.random() - 0.5) * (1 + intensity * 2);
      vel[i * 3 + 2] = -1 - Math.random() * (2 + intensity * 2);
    }
    pos[i * 3] += vel[i * 3] * delta;
    pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
    pos[i * 3 + 2] += vel[i * 3 + 2] * delta;
    if (pos[i * 3 + 2] < -3) {
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = -100;
    }
  }
  heatParticleGeometry.attributes.position.needsUpdate = true;
  heatParticleMaterial.opacity = intensity * 0.5;
  heatParticleMaterial.size = 0.05 + intensity * 0.2;
}
"""
        content = content[:dust_pos + len(dust_marker)] + heat_effects + content[dust_pos + len(dust_marker):]
    
    # 3. Camera Shake Funktion hinzufügen (vor emitDustBurst)
    emit_pos = content.find('function emitDustBurst(worldPos, count=30){')
    if emit_pos != -1:
        camera_shake_func = """
// Camera shake function
function applyCameraShake(camera, intensity) {
  if (intensity <= 0) return;
  camera.position.x += (Math.random() - 0.5) * intensity * 0.1;
  camera.position.y += (Math.random() - 0.5) * intensity * 0.1;
  camera.position.z += (Math.random() - 0.5) * intensity * 0.1;
}

"""
        content = content[:emit_pos] + camera_shake_func + content[emit_pos:]
    
    # 4. startLandingSequence anpassen
    start_old = """  // STATE MACHINE auf Approach setzen (neue Phase 1 für Animation)
  state.seqState = 1; // approach
  state.seqPlanet = planet;
  state.seqTimer = 0;
  state.seqStartPos = state.pos.clone();
  state.seqLandingPos = landingPos.clone();"""
    
    start_new = """  // STATE MACHINE: Start mit Atmosphäreneintritt (Phase 1)
  state.seqState = 1; // atmospheric entry
  state.seqPlanet = planet;
  state.seqTimer = 0;
  state.seqStartPos = state.pos.clone();
  state.seqLandingPos = landingPos.clone();
  state.seqLandingNormal = landingNormal.clone();
  
  // Atmosphäreneintritt aktivieren
  state.inAtmosphere = true;
  state.heatIntensity = 0;
  state.cameraShakeIntensity = 0;"""
    
    content = content.replace(start_old, start_new)
    
    # 5. updateLandingSequence vollständig ersetzen
    update_start = content.find('function updateLandingSequence(delta){')
    update_end = content.find('// ===================== 3D LAUNCH SEQUENCE =====================', update_start)
    
    if update_start != -1 and update_end != -1:
        new_update_func = '''function updateLandingSequence(delta){
  const p = state.seqPlanet;
  if(!p) return;
  state.seqTimer += delta;

  // Update heat effects during atmospheric entry and descent
  if (state.seqState >= 1 && state.seqState <= 3) {
    updateHeatEffects(delta);
  }

  if(state.seqState === 1){
    // ======= ATMOSPHERIC ENTRY: Hitzeeffekte und seitliche Kamera =======
    const entryDuration = 2.5;
    const t = Math.min(1, state.seqTimer / entryDuration);
    const st = t * t;

    // Hitzeintensität (max bei 50%)
    state.heatIntensity = Math.min(1, Math.sin(t * Math.PI) * 1.2);
    state.inAtmosphere = true;

    // Kamera-Shake für Realismus
    if (t > 0.2 && t < 0.8) {
      state.cameraShakeIntensity = state.heatIntensity * 0.3;
    } else {
      state.cameraShakeIntensity = 0;
    }

    // Zielposition: Atmosphärengrenze
    const atmosphereHeight = p.data.size * 1.15;
    const atmosphereTarget = p.group.position.clone().add(
      state.seqLandingNormal.clone().multiplyScalar(atmosphereHeight)
    );

    state.pos.lerpVectors(state.seqStartPos, atmosphereTarget, st);
    state.pitch += (0.3 - state.pitch) * 0.05;
    const toPlanet = p.group.position.clone().sub(state.pos).normalize();
    state.yaw += (Math.atan2(toPlanet.x, toPlanet.z) - state.yaw) * 0.05;
    state.vel.multiplyScalar(0.92);
    state.speed = state.vel.length();

    document.getElementById('seqStatus').textContent='🔥 Atmosphäreneintritt';
    document.getElementById('nearHint').textContent=`🌡️ Hitze: ${Math.round(state.heatIntensity * 100)}%`;

    if(t >= 1){
      state.seqState = 2;
      state.seqTimer = 0;
      state.seqStartPos = state.pos.clone();
      state.heatIntensity = 0.5;
      document.getElementById('seqStatus').textContent='🎯 Anflug';
    }
  } else if(state.seqState === 2){
    // ======= APPROACH: Langsames Annähern =======
    const approachDuration = 2.0;
    const t = Math.min(1, state.seqTimer / approachDuration);
    const st = t * t;

    state.heatIntensity = Math.max(0, state.heatIntensity - delta * 0.3);

    const approachHeight = 5;
    const approachTarget = state.seqLandingPos.clone().add(
      state.seqLandingNormal.clone().multiplyScalar(approachHeight)
    );

    state.pos.lerpVectors(state.seqStartPos, approachTarget, st);
    state.pitch += (0.3 - state.pitch) * 0.05;
    const toPlanet = p.group.position.clone().sub(state.pos).normalize();
    state.yaw += (Math.atan2(toPlanet.x, toPlanet.z) - state.yaw) * 0.05;
    state.vel.multiplyScalar(0.95);
    state.speed = state.vel.length();

    document.getElementById('seqStatus').textContent='🎯 Anflug';
    document.getElementById('nearHint').textContent=`🛸 Anflug: ${Math.round((1-st)*100)}%`;

    if(t >= 1){
      state.seqState = 3;
      state.seqTimer = 0;
      state.seqStartPos = state.pos.clone();
      state.inAtmosphere = true;
      state.heatIntensity = 0.3;
      document.getElementById('seqStatus').textContent='⬇️ Sinkflug';
    }
  } else if(state.seqState === 3){
    // ======= DESCENT: Sanfter Sinkflug =======
    const duration = CFG.landing.descentDuration;
    const t = Math.min(1, state.seqTimer / duration);
    const st = t * t * (3 - 2 * t);

    const landingPos = state.seqLandingPos.clone();
    const landingNormal = state.seqLandingNormal.clone();

    state.pos.lerpVectors(state.seqStartPos, landingPos, st);

    // Pitch hochziehen
    const pitchCurve = 1.0 - Math.min(0.8, t * t * 2.5);
    state.pitch += (pitchCurve * 1.2 - state.pitch) * 0.08;
    state.yaw += Math.sin(state.seqTimer * 3) * 0.004;

    // Gear ausfahren bei ~50%
    if(st > 0.5 && !legGroup.visible){
      legGroup.visible = true;
      legGroup.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), landingNormal));
      document.getElementById('seqStatus').textContent='🦿 Fahrwerk';
      setTimeout(()=>{document.getElementById('seqStatus').textContent='⬇️ Landen';},400);
    }

    // Bei ~75% → Flare-Phase
    if(st > 0.7){
      state.seqState = 4;
      state.seqTimer = 0;
      state.seqStartPos = state.pos.clone();
      document.getElementById('seqStatus').textContent='🔄 Abfangen';
    }

    // Distanz-Info
    const dist = state.pos.distanceTo(p.group.position);
    const currentTerrainHeight = getTerrainHeight(p, state.pos);
    const heightAboveTerrain = Math.max(0, dist - currentTerrainHeight);
    document.getElementById('nearHint').textContent=`🛸 ${Math.round(heightAboveTerrain * 1000)} m`;
  } else if(state.seqState === 4){
    // ======= FLARE + TOUCHDOWN =======
    const duration = 1.0;
    const t = Math.min(1, state.seqTimer / duration);
    const st = t * t * (3 - 2 * t);

    const landingPos = state.seqLandingPos.clone();
    const landingNormal = state.seqLandingNormal.clone();

    state.pos.lerpVectors(state.seqStartPos, landingPos, st);
    state.pitch *= 0.9;
    if(Math.abs(state.pitch) < 0.05) state.pitch = 0;

    if(legGroup.visible) {
      legGroup.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), landingNormal));
    }

    // Vibration kurz vor Touchdown
    if(st > 0.85){
      const vib = (1 - st) * 0.05;
      state.pos.x += (Math.random()-0.5) * vib;
      state.pos.z += (Math.random()-0.5) * vib;
      state.cameraShakeIntensity = (1 - st) * 0.5;
    }

    // Distanz-Info
    const dist = state.pos.distanceTo(p.group.position);
    const currentTerrainHeight = getTerrainHeight(p, state.pos);
    const heightAboveTerrain = Math.max(0, dist - currentTerrainHeight);
    const heightM = Math.round(heightAboveTerrain * 1000);
    if (heightM < 100) {
      document.getElementById('nearHint').textContent=`🛸 ${heightM} m - 🔥 LANDUNG!`;
    } else {
      document.getElementById('nearHint').textContent=`🛸 ${heightM} m`;
    }

    // Touchdown!
    if(t >= 1){
      const finalRaycaster = new THREE.Raycaster();
      const finalDir = p.group.position.clone().sub(state.pos).normalize();
      finalRaycaster.set(state.pos.clone(), finalDir.negate());
      const finalIntersects = finalRaycaster.intersectObject(p.mesh, true);

      let finalLandingPos = landingPos.clone();
      if(finalIntersects.length > 0) {
        finalLandingPos = finalIntersects[0].point.clone();
      } else {
        const distToCenter = state.pos.distanceTo(p.group.position);
        finalLandingPos = p.group.position.clone().add(
          finalDir.clone().multiplyScalar(Math.max(p.data.size, distToCenter))
        );
      }

      state.pos.copy(finalLandingPos);
      state.seqLandingPos = finalLandingPos.clone();
      state.seqLandingNormal = finalIntersects.length > 0 && finalIntersects[0].face ?
        finalIntersects[0].face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(p.mesh.matrixWorld)) :
        finalDir.clone();

      state.vel.set(0,0,0);
      state.speed = 0;
      state.inAtmosphere = false;
      state.heatIntensity = 0;
      state.cameraShakeIntensity = 0.8;

      legGroup.visible = true;
      legGroup.rotation.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), landingNormal));

      // Dust an Touchdown-Position
      const dustWorldPos = landingPos.clone().add(landingNormal.clone().multiplyScalar(-0.1));
      emitDustBurst(dustWorldPos, 45);

      state.seqState = 5; // landed
      state.landed = true;
      state.landedOn = p;

      document.getElementById('landBtn').textContent='🚀 Starten (Enter)';
      document.getElementById('landBtn').className='show launch';
      document.getElementById('locName').textContent=`🛸 ${p.data.name}`;
      document.getElementById('landPlanetName').textContent=`🪐 ${p.data.name}`;
      document.getElementById('landedUI').classList.add('show');
      document.getElementById('landingZone').classList.remove('show');
      document.getElementById('seqStatus').textContent='✅ Gelandet!';
      document.getElementById('nearHint').textContent='–';
      setTimeout(()=>{document.getElementById('seqStatus').className='';},2000);
      closePlanetInfo();
    }
  }
}

'''
        content = content[:update_start] + new_update_func + content[update_end:]
    
    # 6. Kamera-Logik in update-Funktion anpassen
    camera_old = '''  // ===== LANDING/LAUNCH SEQUENCE ACTIVE? =====
  if(state.seqState >= 1 && state.seqState <= 3){
    updateLandingSequence(delta);
    updateDust(delta);
    // Ship vis update
    shipGroup.position.copy(state.pos);
    shipGroup.rotation.set(state.pitch,state.yaw,0);
    // Camera während Landing-Sequenz
    if(state.seqState === 1){
      // Während Approach: normale Chase-Cam
      const targetDist=4;
      state.camDist+=(targetDist-state.camDist)*0.08;
      const horizontalOnly=new THREE.Vector3(0,state.camDist*0.4,state.camDist);
      horizontalOnly.applyEuler(new THREE.Euler(0,state.yaw,0,'YXZ'));
      const camPos=state.pos.clone().add(horizontalOnly);
      camPos.y+=1.5+state.camDist*0.08;
      camera.position.lerp(camPos,0.15);
      const camLook=state.pos.clone().add(new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(0,state.yaw,0,'YXZ')).multiplyScalar(3));
      camera.lookAt(camLook);
    } else if(state.seqState === 2) {
      // Während Descent: Kamera nah an der Oberfläche für bessere 3D-Wirkung
      const camOffset = new THREE.Vector3(0, 0.8, 2);
      camOffset.applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, 'YXZ'));
      const camPos = state.pos.clone().add(camOffset);
      camera.position.lerp(camPos, 0.15);
      const lookTarget = state.pos.clone().add(new THREE.Vector3(0, 0, -3).applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, 'YXZ')));
      camera.lookAt(lookTarget);
    } else if(state.seqState === 3) {
      // Während Flare/Touchdown: Sehr nah für dramatische Landung
      const landingNormal = state.seqLandingNormal.clone();
      const sideOffset = new THREE.Vector3(-landingNormal.z, 0, landingNormal.x).normalize().multiplyScalar(1.5);
      const camPos = state.pos.clone().add(landingNormal.clone().multiplyScalar(1.2)).add(sideOffset);
      camera.position.lerp(camPos, 0.2);
      camera.lookAt(state.pos.clone().add(landingNormal.clone().multiplyScalar(0.1)));
    }'''
    
    camera_new = '''  // ===== LANDING/LAUNCH SEQUENCE ACTIVE? =====
  if(state.seqState >= 1 && state.seqState <= 5){
    updateLandingSequence(delta);
    updateDust(delta);
    // Ship vis update
    shipGroup.position.copy(state.pos);
    shipGroup.rotation.set(state.pitch,state.yaw,0);
    
    // Kamera-Shake anwenden
    applyCameraShake(camera, state.cameraShakeIntensity);
    
    // Camera während Landing-Sequenz - SEITANSICHT für Atmosphäreneintritt
    if(state.seqState === 1){
      // Während Atmosphäreneintritt: SEITLICHE ANSICHT für Hitzeeffekte
      const shipRight = new THREE.Vector3(Math.sin(state.yaw + Math.PI/2), 0, Math.cos(state.yaw + Math.PI/2));
      const camOffset = shipRight.clone().multiplyScalar(4).add(new THREE.Vector3(0, 1, 0));
      const camPos = state.pos.clone().add(camOffset);
      camera.position.lerp(camPos, 0.15);
      camera.lookAt(state.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    } else if(state.seqState === 2) {
      // Während Approach: normale Chase-Cam
      const targetDist=4;
      state.camDist+=(targetDist-state.camDist)*0.08;
      const horizontalOnly=new THREE.Vector3(0,state.camDist*0.4,state.camDist);
      horizontalOnly.applyEuler(new THREE.Euler(0,state.yaw,0,'YXZ'));
      const camPos=state.pos.clone().add(horizontalOnly);
      camPos.y+=1.5+state.camDist*0.08;
      camera.position.lerp(camPos,0.15);
      const camLook=state.pos.clone().add(new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(0,state.yaw,0,'YXZ')).multiplyScalar(3));
      camera.lookAt(camLook);
    } else if(state.seqState === 3) {
      // Während Descent: Kamera nah an der Oberfläche für bessere 3D-Wirkung
      const camOffset = new THREE.Vector3(0, 0.8, 2);
      camOffset.applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, 'YXZ'));
      const camPos = state.pos.clone().add(camOffset);
      camera.position.lerp(camPos, 0.15);
      const lookTarget = state.pos.clone().add(new THREE.Vector3(0, 0, -3).applyEuler(new THREE.Euler(state.pitch, state.yaw, 0, 'YXZ')));
      camera.lookAt(lookTarget);
    } else if(state.seqState === 4) {
      // Während Flare/Touchdown: SEITLICHE ANSICHT für dramatische Landung
      const shipRight = new THREE.Vector3(Math.sin(state.yaw + Math.PI/2), 0, Math.cos(state.yaw + Math.PI/2));
      const sideOffset = shipRight.clone().multiplyScalar(3);
      const camPos = state.pos.clone().add(sideOffset).add(new THREE.Vector3(0, 0.8, 0));
      camera.position.lerp(camPos, 0.2);
      camera.lookAt(state.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    }'''
    
    content = content.replace(camera_old, camera_new)
    
    # 7. HUD-Anzeige für Geschwindigkeit und Höhe anpassen
    speed_old = '''    // HUD
    document.getElementById('speedVal').textContent=Math.round(state.speed*10)/10;'''
    
    speed_new = '''    // HUD - Geschwindigkeit und Höhe anzeigen
    if (state.seqState >= 1 && state.seqState <= 4) {
      const p = state.seqPlanet;
      if (p) {
        const height = state.pos.distanceTo(p.group.position) - p.data.size;
        document.getElementById('speedVal').textContent=`${Math.round(state.speed*10)/10} / ${Math.round(Math.max(0, height)*1000)}m`;
      }
    } else {
      document.getElementById('speedVal').textContent=Math.round(state.speed*10)/10;
    }'''
    
    content = content.replace(speed_old, speed_new)
    
    # 8. Flammeneffekte verstärken
    flame_old = '''  // Flames
  const isBoosting=boostDown,speedNorm=state.landed?0:Math.min(1,state.speed/20);
  const flameI=state.landed?0.15:(isBoosting?1.0:0.2+speedNorm*0.8);'''
    
    flame_new = '''  // Flames - verstärken während Atmosphäreneintritt
  const isBoosting=boostDown,speedNorm=state.landed?0:Math.min(1,state.speed/20);
  const heatBoost = state.inAtmosphere ? 0.5 + state.heatIntensity * 0.5 : 0;
  const flameI=state.landed?0.15:(isBoosting?1.0:0.2+speedNorm*0.8+heatBoost);'''
    
    content = content.replace(flame_old, flame_new)
    
    # 9. Launch-Sequenz-Phasen anpassen
    content = content.replace('state.seqState = 5; // liftoff', 'state.seqState = 6; // liftoff')
    content = content.replace('else if(state.seqState === 6){', 'else if(state.seqState === 7){')
    content = content.replace('state.seqState = 6;', 'state.seqState = 7;', 1)  # Nur das erste Vorkommen
    
    # 10. Launch-Sequenz in update-Funktion anpassen
    content = content.replace(
        'if(state.seqState >= 5){',
        'if(state.seqState >= 6 && state.seqState <= 7){'
    )
    
    # 11. Auto-Landung nur starten, wenn keine Sequenz aktiv ist
    content = content.replace(
        'if(nearDist < nearest.data.size + 3.5 && state.speed < CFG.landing.autoLandSpeed && !state.touchActive){',
        'if(nearDist < nearest.data.size + 3.5 && state.speed < CFG.landing.autoLandSpeed && !state.touchActive && state.seqState === 0){'
    )
    
    # Speichere die modifizierte Datei
    with open(file_path, 'w') as f:
        f.write(content)
    
    print("Alle Änderungen erfolgreich angewendet!")
    print(f"Dateigröße: {len(content)} Zeichen")

if __name__ == '__main__':
    main()
