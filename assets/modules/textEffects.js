// File: assets/modules/textEffects.js (Phiên bản nhân đôi ruy-băng)
import * as THREE from "three";

let ribbon, textSpritePool = [], activeTexts;
let allWordsFlat = [], currentWordIndex = 0, nextWordSpawnTime = 0;

function createTextSpriteTexture(text, isLongText = false) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const font = `bold ${isLongText ? '80px' : '70px'} "Mali", sans-serif`;
    context.font = font; canvas.width = isLongText ? 2048 : 1024; canvas.height = isLongText ? 256 : 128;
    context.font = font; context.textAlign = "center"; context.textBaseline = "middle";
    context.strokeStyle = "rgba(160, 30, 95, 0.9)"; context.lineWidth = isLongText ? 3 : 8;
    const x = canvas.width / 2, y = canvas.height / 2;
    if (isLongText) {
        context.shadowColor = "#ff40c8"; context.fillStyle = "#ff40c8"; context.fillText(text, x, y);
    }
    context.strokeText(text, x, y); context.fillStyle = "#ffffff"; context.fillText(text, x, y);
    return new THREE.CanvasTexture(canvas);
}

export function createTextEffects(scene, streamHeart, appData, heartData) {
    activeTexts = new Map();
    const { messages } = appData;
    const { heartWidth, maxY } = heartData;
    const nonEmptyMessages = messages.filter(m => m.trim() !== "");
    allWordsFlat = nonEmptyMessages.join(" ").split(" ").filter(w => w.length > 0);

    ribbon = new THREE.Group();
    const RING_Y_OFFSET = 2.5 * -maxY - 0.5;
    ribbon.position.set(0, maxY + RING_Y_OFFSET + 8, 0);
    ribbon.rotation.z = Math.PI;
    scene.add(ribbon);

    // === LOGIC MỚI: TẠO 2 BỘ RUY-BĂNG ===
    const verticalSpacing = 1.0;
    
    // Vòng lặp 2 lần để tạo 2 bộ
    for (let lap = 0; lap < 2; lap++) {
        // Bộ thứ hai (lap = 1) sẽ nhỏ hơn và mờ hơn
        const isSecondSet = (lap === 1);
        const baseRadius = heartWidth * (isSecondSet ? 0.45 : 0.7); // Bán kính nhỏ hơn cho bộ thứ hai
        const opacity = isSecondSet ? 0.7 : 1.0; // Mờ hơn cho bộ thứ hai

        nonEmptyMessages.forEach((message, index) => {
            const texture = createTextSpriteTexture(message, true);
            texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(2, 1);
            
            const material = new THREE.MeshBasicMaterial({ 
                map: texture, transparent: true, side: THREE.DoubleSide, 
                depthWrite: false, blending: THREE.AdditiveBlending, opacity: opacity 
            });

            const radius = baseRadius * (1 - index * 0.1);
            const geometry = new THREE.CylinderGeometry(radius, radius, 1, 128, 1, true);
            const mesh = new THREE.Mesh(geometry, material);

            mesh.rotation.x = Math.PI;
            
            // Tính toán vị trí Y dựa trên cả vòng lặp (lap) và vị trí trong bộ (index)
            const totalIndex = (lap * nonEmptyMessages.length) + index;
            mesh.position.y = totalIndex * -verticalSpacing;

            // Tốc độ xoay ngẫu nhiên
            mesh.userData.rotationSpeed = (Math.random() - 0.5) * 0.005;

            mesh.scale.set(1, 4 , 1);
            
            ribbon.add(mesh);
        });
    }
    
    // Tạo pool cho các từ bay ra (giữ nguyên)
    [...new Set(allWordsFlat)].forEach(word => {
        const texture = createTextSpriteTexture(word);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sprite.scale.set(1.5 * (texture.image.width / texture.image.height), 1.5, 1);
        sprite.visible = false; sprite.userData = { active: false, text: word };
        streamHeart.add(sprite); textSpritePool.push(sprite);
    });

    return { ribbon, activeTexts, releaseTextToPool: (i) => releaseTextToPool(i) };
}

function releaseTextToPool(particleIndex) {
    if (activeTexts.has(particleIndex)) {
        const sprite = activeTexts.get(particleIndex);
        sprite.visible = false; sprite.userData.active = false;
        activeTexts.delete(particleIndex);
    }
}

export function updateTextEffects(textEffects, streamData, elapsedTime) {
    const { ribbon, activeTexts } = textEffects;
    const { streamState, startTimes, streamRiseDuration, streamHeart } = streamData;
    const streamPositions = streamHeart.geometry.attributes.position.array;
    
    ribbon.children.forEach(mesh => {
        mesh.rotation.y += mesh.userData.rotationSpeed;
    });

    if (allWordsFlat.length > 0 && elapsedTime > nextWordSpawnTime) {
        let availableParticle = -1;
        for (let i = 0; i < streamState.length; i++) {
            const progress = (elapsedTime - startTimes[i]) / streamRiseDuration[i];
            if (streamState[i] === 1 && progress > 0.05 && progress < 0.2 && !activeTexts.has(i)) {
                availableParticle = i; break;
            }
        }
        if (availableParticle !== -1) {
            const word = allWordsFlat[currentWordIndex];
            const sprite = textSpritePool.find(s => !s.userData.active && s.userData.text === word);
            if (sprite) {
                sprite.userData.active = true; sprite.userData.spawnTime = elapsedTime;
                sprite.visible = true; sprite.material.opacity = 0;
                activeTexts.set(availableParticle, sprite);
                currentWordIndex = (currentWordIndex + 1) % allWordsFlat.length;
                nextWordSpawnTime = elapsedTime + 0.4;
            }
        }
    }

    activeTexts.forEach((sprite, pIndex) => {
        sprite.position.set(streamPositions[pIndex*3], streamPositions[pIndex*3+1]+1.5, streamPositions[pIndex*3+2]);
        const timeAlive = elapsedTime - sprite.userData.spawnTime, riseProgress = (elapsedTime - startTimes[pIndex]) / streamRiseDuration[pIndex];
        sprite.material.opacity = timeAlive < 0.8 ? timeAlive/0.8 : (riseProgress > 0.7 ? Math.max(0,1-(riseProgress-0.7)/0.3) : 1);
        if (streamState[pIndex] === 0 || riseProgress >= 1) releaseTextToPool(pIndex);
    });
}