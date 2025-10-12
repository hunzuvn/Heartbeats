// File: assets/modules/particleStream.js
import * as THREE from "three";
import { makeMat } from "./utils.js";

let streamHeart, streamState, startTimes, streamRiseDuration, targetIdxArr,
    curRadiusArr, spiralPhase, initialRadius, extraRotArr, ascendStart;

export function createParticleStream(scene, heartData, heartInitialColor) {
    const { topIndices, heartWidth, maxY } = heartData;
    const streamCount = Math.floor(0.2 * topIndices.length);
    targetIdxArr = new Uint32Array(streamCount);
    for (let i = 0; i < streamCount; i++) {
        targetIdxArr[i] = topIndices[i % topIndices.length];
    }

    const streamPositions = new Float32Array(3*streamCount), streamAlpha = new Float32Array(streamCount).fill(1),
          streamColors = new Float32Array(3*streamCount), streamSizes = new Float32Array(streamCount);
    
    const color = new THREE.Color(heartInitialColor);
    for (let i = 0; i < streamCount; i++) {
        streamColors.set([color.r, color.g, color.b], i*3);
        streamSizes[i] = 2 * (0.3*Math.random() + 0.3);
    }
    
    const streamGeo = new THREE.BufferGeometry();
    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3).setUsage(THREE.DynamicDrawUsage));
    streamGeo.setAttribute('alpha', new THREE.BufferAttribute(streamAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));
    streamGeo.setAttribute('size', new THREE.BufferAttribute(streamSizes, 1));

    streamHeart = new THREE.Points(streamGeo, makeMat({ map: heartData.circleTexture, alphaSupport: true, alphaTest: 0.5 }));
    streamHeart.rotation.z = Math.PI;
    streamHeart.position.y = 8;
    scene.add(streamHeart);

    streamState = new Uint8Array(streamCount); startTimes = new Float32Array(streamCount);
    curRadiusArr = new Float32Array(streamCount); ascendStart = new Float32Array(streamCount);
    spiralPhase = new Float32Array(streamCount); initialRadius = new Float32Array(streamCount);
    extraRotArr = new Float32Array(streamCount); streamRiseDuration = new Float32Array(streamCount);
    
    for (let i = 0; i < streamCount; i++) {
        initializeStreamParticle(i, 0, heartWidth, maxY);
    }
    streamGeo.attributes.position.needsUpdate = true;
    
    return { streamHeart, streamState, startTimes, streamRiseDuration,
             initializeStreamParticle: (i, t) => initializeStreamParticle(i, t, heartWidth, maxY) };
}

function initializeStreamParticle(i, time, heartWidth, planeY) {
    const radius = 0.25 + (0.6 * heartWidth - 0.25) * Math.random(), phase = Math.random() * Math.PI * 2;
    streamHeart.geometry.attributes.position.array.set([Math.cos(phase)*radius, planeY, Math.sin(phase)*radius], i*3);
    curRadiusArr[i] = radius; spiralPhase[i] = phase; streamState[i] = 0;
    startTimes[i] = time - (Math.random() * 0.6 * heartWidth) / 0.9;
    ascendStart[i] = 10 * Math.random(); streamRiseDuration[i] = 8 + 4 * Math.random();
    extraRotArr[i] = (0.5+1.5*Math.random())*Math.PI*2*(Math.random()<0.5?-1:1);
    streamHeart.geometry.attributes.alpha.array[i] = 1;
}

export function updateParticleStream(streamData, heart, image, text, elapsedTime, appState) {
    if (!appState.streamHeartStarted) return;
    
    const { streamHeart, streamState, startTimes, streamRiseDuration, initializeStreamParticle } = streamData;
    const { elements, data } = heart;
    
    const streamPositions = streamHeart.geometry.attributes.position.array;
    const streamAlpha = streamHeart.geometry.attributes.alpha.array;
    const staticHeartAlpha = elements.staticHeart.geometry.attributes.alpha;

    const BASE_OMEGA = (-1 * Math.PI) / 10;
    const planeY = data.maxY;

    for (let i = 0; i < streamState.length; i++) {
        const i3 = i * 3, timeSinceStart = elapsedTime - (startTimes[i] + (i % 5) * 1.6);
        
        if (streamState[i] === 0) { // State 0: In Vortex
            const currentPhase = spiralPhase[i] + BASE_OMEGA * (elapsedTime - startTimes[i]);
            streamPositions.set([Math.cos(currentPhase) * curRadiusArr[i], planeY, Math.sin(currentPhase) * curRadiusArr[i]], i3);
            if (image.activeImages.has(i)) image.releaseImageToPool(i);
            if (text.activeTexts.has(i)) text.releaseTextToPool(i);
            if (timeSinceStart >= ascendStart[i]) {
                streamState[i] = 1; startTimes[i] = elapsedTime; initialRadius[i] = curRadiusArr[i];
            }
            continue;
        }

        // State 1: Ascending
        if (timeSinceStart >= streamRiseDuration[i]) {
            initializeStreamParticle(i, elapsedTime);
            continue;
        }
        
        const progress = timeSinceStart / streamRiseDuration[i];
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        const startPhase = spiralPhase[i] + BASE_OMEGA * (elapsedTime-startTimes[i]);
        const startX = Math.cos(startPhase)*initialRadius[i], startZ = Math.sin(startPhase)*initialRadius[i];
        
        const targetIdx = targetIdxArr[i], targetI3 = targetIdx * 3;
        const targetX = data.positions[targetI3], targetY = data.positions[targetI3+1], targetZ = data.positions[targetI3+2];
        
        let pX = THREE.MathUtils.lerp(startX, targetX, easedProgress);
        let pY = THREE.MathUtils.lerp(planeY, targetY, easedProgress);
        let pZ = THREE.MathUtils.lerp(startZ, targetZ, easedProgress);
        
        const extraRotation = (1-easedProgress)*extraRotArr[i], cosR = Math.cos(extraRotation), sinR = Math.sin(extraRotation);
        streamPositions.set([pX*cosR-pZ*sinR, pY, pX*sinR+pZ*cosR], i3);
        
        streamAlpha[i] = (image.activeImages.has(i) || text.activeTexts.has(i)) ? 0 : 1;

        if (progress > 0.95) {
            const topIdx = data.idxToTopIdx[targetIdx];
            if (topIdx !== -1) staticHeartAlpha.array[topIdx] = 0;
        }
    }
    streamHeart.geometry.attributes.position.needsUpdate = true;
    streamHeart.geometry.attributes.alpha.needsUpdate = true;
    staticHeartAlpha.needsUpdate = true;
}