// File: assets/modules/interaction.js
import * as THREE from "three";
import { makeMat } from "./utils.js";

const explosionEffects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const HEART_CENTER_TARGET = new THREE.Vector3(0, 10, 0);

export function setupInteractions(scene, camera, appState, circleTexture) {
    document.body.addEventListener("pointerdown", (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const explosionDistance = 15;
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.at(explosionDistance, intersectPoint);
        
        createExplosion(scene, intersectPoint, circleTexture);

        // Trigger global pulse state
        if (!appState.isPulsing) {
            appState.isPulsing = true;
            appState.pulseStartTime = appState.elapsedTime;
        }
    });
}

function createExplosion(scene, position, circleTexture) {
    const effectGroup = new THREE.Group();
    const particleCount = 30 + 20 * Math.random();
    const positions = [], colors = [], sizes = [], velocities = [];
    const baseColor = new THREE.Color().setHSL(Math.random(), 0.9, 0.7);

    for (let i = 0; i < particleCount; i++) {
        positions.push(position.x, position.y, position.z);
        const color = baseColor.clone().offsetHSL(THREE.MathUtils.randFloatSpread(0.2), 0, 0);
        colors.push(color.r, color.g, color.b);
        sizes.push(0.8 * Math.random() + 0.2);
        const velocity = new THREE.Vector3().randomDirection().multiplyScalar(15 * Math.random() + 10);
        velocities.push(velocity);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const mat = makeMat({ map: circleTexture, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
    const points = new THREE.Points(geo, mat);
    effectGroup.add(points);
    effectGroup.userData = { life: 1, velocities };
    scene.add(effectGroup);
    explosionEffects.push(effectGroup);
}

export function updateInteractions(delta) {
    for (let i = explosionEffects.length - 1; i >= 0; i--) {
        const effect = explosionEffects[i];
        effect.userData.life -= delta;

        if (effect.userData.life <= 0) {
            effect.parent.remove(effect);
            explosionEffects.splice(i, 1);
        } else {
            const points = effect.children[0];
            const positions = points.geometry.attributes.position.array;
            const velocities = effect.userData.velocities;
            for (let j = 0; j < velocities.length; j++) {
                const j3 = j * 3;
                const particlePos = new THREE.Vector3(positions[j3], positions[j3 + 1], positions[j3 + 2]);
                const gravity = HEART_CENTER_TARGET.clone().sub(particlePos).normalize().multiplyScalar(20);
                velocities[j].add(gravity.multiplyScalar(delta)); // Simple gravity towards center
                positions[j3] += velocities[j].x * delta;
                positions[j3 + 1] += velocities[j].y * delta;
                positions[j3 + 2] += velocities[j].z * delta;
            }
            points.geometry.attributes.position.needsUpdate = true;
            points.material.opacity = effect.userData.life;
        }
    }
}