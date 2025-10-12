// File: assets/modules/imageManager.js
import * as THREE from "three";

let IMAGE_CONFIG = {}, imageTextures = [], imagePool = [], activeImages = new Map(), freeImageIndices = [];
let currentImageIndex = 0, lastImageSpawnTime = 0;

async function fetchAndPrepareTextures(paths) {
    const textureLoader = new THREE.TextureLoader();
    const promises = paths.map(path => textureLoader.loadAsync(path).catch(() => new THREE.CanvasTexture(document.createElement('canvas'))));
    imageTextures = await Promise.all(promises);
    return imageTextures.length > 0;
}

function getAspectRatioScale(texture, baseScale) {
    if (!texture?.image) return { x: baseScale, y: baseScale };
    const aspect = texture.image.width / texture.image.height;
    return { x: aspect > 1 ? baseScale : baseScale * aspect, y: aspect > 1 ? baseScale / aspect : baseScale };
}

export async function createImageManager(streamHeart, appData) {
    IMAGE_CONFIG = {
        paths: appData.images || [],
        count: (appData.images || []).length,
        scale: 2.5,
        spawnInterval: 500,
        minActive: 8,
        maxConcurrent: Math.min(30, Math.ceil(2.5 * (appData.images || []).length)),
    };
    if (IMAGE_CONFIG.count === 0) return { activeImages, releaseImageToPool: () => {} };

    if (await fetchAndPrepareTextures(IMAGE_CONFIG.paths)) {
        for (let i = 0; i < 45; i++) {
            const material = new THREE.SpriteMaterial({ map: imageTextures[0], transparent: true, depthWrite: false });
            const sprite = new THREE.Sprite(material);
            sprite.visible = false; sprite.userData = { poolIndex: i, isActive: false };
            streamHeart.add(sprite); imagePool.push(sprite); freeImageIndices.push(i);
        }
    }
    return { activeImages, releaseImageToPool: (i) => releaseImageToPool(i) };
}

function releaseImageToPool(particleIndex) {
    const poolIndex = activeImages.get(particleIndex);
    if (poolIndex !== undefined) {
        const sprite = imagePool[poolIndex];
        sprite.visible = false; sprite.material.opacity = 0; sprite.userData.isActive = false;
        activeImages.delete(particleIndex); freeImageIndices.push(poolIndex);
    }
}

export function updateImageManager(streamData, imageManager, elapsedTime) {
    if (IMAGE_CONFIG.count === 0) return;
    
    const { streamHeart, streamState } = streamData;
    const streamPositions = streamHeart.geometry.attributes.position.array;

    const totalActive = activeImages.size;
    const shouldSpawn = (elapsedTime - lastImageSpawnTime) >= IMAGE_CONFIG.spawnInterval && totalActive < IMAGE_CONFIG.maxConcurrent;

    if (shouldSpawn) {
        let bestParticle = -1;
        for (let i = 0; i < streamState.length; i++) {
            if (!activeImages.has(i) && streamState[i] === 1) { bestParticle = i; break; }
        }
        if (bestParticle !== -1 && freeImageIndices.length > 0) {
            const poolIndex = freeImageIndices.pop();
            const sprite = imagePool[poolIndex];
            const texture = imageTextures[currentImageIndex % IMAGE_CONFIG.count];
            
            sprite.material.map = texture;
            sprite.scale.set(...Object.values(getAspectRatioScale(texture, IMAGE_CONFIG.scale)), 1);
            sprite.userData.isActive = true; sprite.visible = true;
            
            activeImages.set(bestParticle, poolIndex);
            currentImageIndex++; lastImageSpawnTime = elapsedTime;
        }
    }
    
    activeImages.forEach((poolIndex, particleIndex) => {
        const sprite = imagePool[poolIndex];
        sprite.position.set(streamPositions[particleIndex*3], streamPositions[particleIndex*3+1], streamPositions[particleIndex*3+2]);
        sprite.material.opacity = streamHeart.geometry.attributes.alpha.array[particleIndex] > 0.5 ? 1 : 0;
    });
}