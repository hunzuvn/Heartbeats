// File: assets/modules/heart.js (Đồng bộ hóa chuyển động 2 phần)
import * as THREE from "three";
import { makeMat } from "./utils.js";

// --- Các hàm tiện ích ---
function isPointInsidePolygon(point, vs) {
    let x = point.x, y = point.y, inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getMinDistanceToBorder(px, py, poly) {
    let minDistanceSq = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
        const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
        if (l2 === 0) continue;
        let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const dx = px - (p1.x + t * (p2.x - p1.x)), dy = py - (p1.y + t * (p2.y - p1.y));
        minDistanceSq = Math.min(minDistanceSq, dx * dx + dy * dy);
    }
    return Math.sqrt(minDistanceSq);
}

// --- Hàm chính ---
export function createHeart(heartScene, heartColor, circleTexture) {
    const heartInitialColor = new THREE.Color(heartColor);
    const heartShape = new THREE.Shape();
    heartShape.moveTo(5, 5); heartShape.bezierCurveTo(5, 5, 4, 0, 0, 0);
    heartShape.bezierCurveTo(-6, 0, -6, 7, -6, 7); heartShape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    heartShape.bezierCurveTo(12, 15.4, 16, 11, 16, 7); heartShape.bezierCurveTo(16, 7, 16, 0, 10, 0);
    heartShape.bezierCurveTo(7, 0, 5, 5, 5, 5);
    const polyPts = heartShape.getPoints(100);

    const xs = polyPts.map(p => p.x), ys = polyPts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const heartWidth = maxX - minX;
    
    const positions = [];
    while (positions.length / 3 < 7000) {
        const x = Math.random()*(maxX - minX) + minX, y = Math.random()*(maxY - minY) + minY;
        if (isPointInsidePolygon({ x, y }, polyPts)) {
            const dist = getMinDistanceToBorder(x, y, polyPts);
            const density = 1 / (1 + 2 * dist);
            if (Math.random() < density) {
                positions.push(x - 5, y - 7, 3.6 * (Math.random() - 0.5));
            }
        }
    }

    const allColors = [], allSizes = [];
    for(let i=0; i<positions.length/3; i++) {
        allColors.push(heartInitialColor.r, heartInitialColor.g, heartInitialColor.b);
        allSizes.push(2 * (0.3 * Math.random() + 0.2));
    }
    
    const topIndices = [], bottomIndices = [];
    const thresholdBase = minY + (maxY - minY) / 6;
    for (let i = 0; i < positions.length / 3; i++) {
        const jitter = 0.1 * (Math.random() - 0.5) * (maxY - minY);
        const thresholdWithJitter = thresholdBase + jitter;
        if (positions[i * 3 + 1] > thresholdWithJitter - 7) { 
            topIndices.push(i);
        } else {
            bottomIndices.push(i);
        }
    }

    const topPositions = [], topColors = [], topSizes = [], topAlpha = [];
    const idxToTopIdx = new Int32Array(positions.length / 3).fill(-1);
    topIndices.forEach((idx, counter) => {
        topPositions.push(positions[idx*3], positions[idx*3+1], positions[idx*3+2]);
        topColors.push(allColors[idx*3], allColors[idx*3+1], allColors[idx*3+2]);
        topSizes.push(allSizes[idx]); topAlpha.push(1); idxToTopIdx[idx] = counter;
    });
    const staticGeo = new THREE.BufferGeometry();
    staticGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPositions, 3).setUsage(THREE.DynamicDrawUsage));
    staticGeo.setAttribute('color', new THREE.Float32BufferAttribute(topColors, 3).setUsage(THREE.DynamicDrawUsage));
    staticGeo.setAttribute('size', new THREE.Float32BufferAttribute(topSizes, 1));
    staticGeo.setAttribute('alpha', new THREE.Float32BufferAttribute(topAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    const staticHeart = new THREE.Points(staticGeo, makeMat({ map: circleTexture, alphaSupport: true, alphaTest: 0.5 }));
    
    const bottomPositions = [], bottomColors = [], bottomSizes = [];
    bottomIndices.forEach(idx => {
        bottomPositions.push(positions[idx*3], positions[idx*3+1], positions[idx*3+2]);
        bottomColors.push(allColors[idx*3], allColors[idx*3+1], allColors[idx*3+2]);
        bottomSizes.push(allSizes[idx]);
    });
    const bottomGeo = new THREE.BufferGeometry();
    bottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(bottomPositions, 3).setUsage(THREE.DynamicDrawUsage));
    bottomGeo.setAttribute('color', new THREE.Float32BufferAttribute(bottomColors, 3).setUsage(THREE.DynamicDrawUsage));
    bottomGeo.setAttribute('size', new THREE.Float32BufferAttribute(bottomSizes, 1));
    const bottomHeart = new THREE.Points(bottomGeo, makeMat({ map: circleTexture, alphaSupport: true, vClipSlope: 0.3, clipFrontZ: 0.3, alphaTest: 0.5 }));
    
    let staticTopHeart, staticBottomHeart;
    const borderThreshold = 0.1 * heartWidth;
    const staticTopBorderPos = [];
    topIndices.forEach(idx => {
        const [x,y] = [positions[idx*3], positions[idx*3+1]];
        if (getMinDistanceToBorder(x+5, y+7, polyPts) < borderThreshold && Math.random() < 0.5) {
             staticTopBorderPos.push(x, y, positions[idx*3+2]);
        }
    });
    if(staticTopBorderPos.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(staticTopBorderPos, 3));
        staticTopHeart = new THREE.Points(geo, makeMat({ map: circleTexture, alphaSupport: true, alphaTest: 0.5, vertexColors: false, color: heartInitialColor }));
        staticTopHeart.geometry.setAttribute('color', new THREE.Float32BufferAttribute(staticTopBorderPos.length * 3).setUsage(THREE.DynamicDrawUsage));
    }

    const heartElements = { staticHeart, bottomHeart, staticTopHeart, staticBottomHeart };
    Object.values(heartElements).forEach(h => {
        if (h) {
            h.rotation.z = Math.PI; h.position.y += 10; heartScene.add(h);
        }
    });

    const topCount = topPositions.length / 3;
    const topRadiusArr = new Float32Array(topCount), topPhaseArr = new Float32Array(topCount);
    for (let i = 0; i < topCount; i++) {
        const x = topPositions[i*3], z = topPositions[i*3+2];
        topRadiusArr[i] = Math.hypot(x, z);
        topPhaseArr[i] = Math.atan2(z, x);
    }

    const bottomCount = bottomPositions.length / 3;
    const bottomRadiusArr = new Float32Array(bottomCount), bottomPhaseArr = new Float32Array(bottomCount);
    for (let i = 0; i < bottomCount; i++) {
        const x = bottomPositions[i*3], z = bottomPositions[i*3+2];
        bottomRadiusArr[i] = Math.hypot(x, z);
        bottomPhaseArr[i] = Math.atan2(z, x);
    }
    
    const heartData = { positions, topIndices, idxToTopIdx, maxY: maxY - 7, heartWidth,
                        topRadiusArr, topPhaseArr, bottomRadiusArr, bottomPhaseArr };
    
    return { elements: heartElements, data: heartData };
}

export function updateHeart(heartElements, heartData, elapsedTime, controls, appState, heartInitialColor) {
    const { staticHeart, bottomHeart } = heartElements;
    const { topRadiusArr, topPhaseArr, bottomRadiusArr, bottomPhaseArr } = heartData;
    const allHeartParts = Object.values(heartElements).filter(h => h);
    
    // Áp dụng hiệu ứng sóng cho cả phần trên...
    if (staticHeart) {
        const positions = staticHeart.geometry.attributes.position.array;
        for (let i = 0; i < topRadiusArr.length; i++) {
            const phase = topPhaseArr[i], baseRadius = topRadiusArr[i];
            const timeWave = Math.sin(elapsedTime * 2.5 + phase * 3);
            const dynamicRadius = baseRadius * (1 + 0.04 * timeWave);
            positions[i*3] = Math.cos(phase) * dynamicRadius;
            positions[i*3+2] = Math.sin(phase) * dynamicRadius;
        }
        staticHeart.geometry.attributes.position.needsUpdate = true;
    }

    // ...và phần dưới của trái tim
    if (bottomHeart) {
        const positions = bottomHeart.geometry.attributes.position.array;
        for (let i = 0; i < bottomRadiusArr.length; i++) {
            const phase = bottomPhaseArr[i], baseRadius = bottomRadiusArr[i];
            const timeWave = Math.sin(elapsedTime * 2.5 + phase * 3);
            const dynamicRadius = baseRadius * (1 + 0.04 * timeWave);
            positions[i*3] = Math.cos(phase) * dynamicRadius;
            positions[i*3+2] = Math.sin(phase) * dynamicRadius;
        }
        bottomHeart.geometry.attributes.position.needsUpdate = true;
    }

    const { isPulsing, pulseStartTime, heartbeatEnabled, useCustomColor } = appState;
    const azimuthalAngle = controls.getAzimuthalAngle();
    const baseColor = useCustomColor ? new THREE.Color(heartInitialColor) : new THREE.Color().setHSL((0.05 * elapsedTime) % 1, 0.8, 0.6);
    
    if (isPulsing) {
        const pulseProgress = Math.min((elapsedTime - pulseStartTime) / 0.6, 1);
        const pulseSine = Math.sin(pulseProgress * Math.PI);
        const scale = 1 + 0.15 * pulseSine;
        allHeartParts.forEach(h => h.scale.set(scale, scale, scale));
        baseColor.lerp(new THREE.Color(0xffffff), 0.8 * pulseSine);
        if (pulseProgress >= 1) {
            appState.isPulsing = false;
            allHeartParts.forEach(h => h.scale.set(1, 1, 1));
        }
    } else if (heartbeatEnabled) {
         // Trả lại nhịp tim chậm như cũ
         const scale = 1 + 0.05 * Math.sin(0.5 * elapsedTime * Math.PI * 2);
         allHeartParts.forEach(h => h.scale.set(scale, scale, scale));
    }
    
    allHeartParts.forEach(h => {
        h.rotation.y = azimuthalAngle;
        const colors = h.geometry.attributes.color.array;
        for (let i = 0; i < colors.length; i += 3) {
            colors[i] = baseColor.r; colors[i+1] = baseColor.g; colors[i+2] = baseColor.b;
        }
        h.geometry.attributes.color.needsUpdate = true;
    });
}