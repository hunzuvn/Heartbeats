// File: assets/modules/background.js (Hiệu ứng "Tấm Chắn Vô Hình")
import * as THREE from "three";
import { makeMat } from "./utils.js";

let starGroup, starLayers = [], cosmicDust, shootingStars;
let nextShootTime = 0;

const SHOOTING_STAR_LIFESPAN = 3.0;
const TAIL_LENGTH = 600; 

async function createTextureStars(scene) {
    starGroup = new THREE.Group();
    const textureLoader = new THREE.TextureLoader();
    const starPromises = ['star1.png', 'star2.png', 'star3.png'].map(fileName =>
        textureLoader.loadAsync(`./assets/${fileName}`)
    );
    const starTextures = await Promise.all(starPromises);

    const bgStarVertexShader = `
        uniform float uTime; uniform float uSize; varying float vRotation;
        void main() {
            vec4 viewPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = max(uSize * (1.0 / -viewPosition.z), 3.0); 
            vRotation = uTime * 0.1;
        }`;
    const bgStarFragmentShader = `
        uniform sampler2D uTexture; varying float vRotation;
        void main() {
            float mid = 0.5;
            vec2 rotated = vec2(cos(vRotation) * (gl_PointCoord.x - mid) - sin(vRotation) * (gl_PointCoord.y - mid) + mid, sin(vRotation) * (gl_PointCoord.x - mid) + cos(vRotation) * (gl_PointCoord.y - mid) + mid);
            vec4 textureColor = texture2D(uTexture, rotated);
            if (textureColor.a < 0.1) discard;
            gl_FragColor = textureColor;
        }`;
    
    starTextures.forEach(texture => {
        const starGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        for (let i = 0; i < 20000 / 3; i++) {
            starVertices.push(THREE.MathUtils.randFloatSpread(1500), THREE.MathUtils.randFloatSpread(1500), THREE.MathUtils.randFloatSpread(1500));
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0.0 }, uTexture: { value: texture }, uSize: { value: 1200.0 } },
            vertexShader: bgStarVertexShader, fragmentShader: bgStarFragmentShader,
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        });
        starGroup.add(new THREE.Points(starGeometry, starMaterial));
    });
    scene.add(starGroup);
}

function createPointStars(scene, circleTexture) {
    const createStarLayer = ({ count, radius, colors, minSize, maxSize, opacity }) => {
        const positions = new Float32Array(count * 3), colorsArr = new Float32Array(count * 3), sizes = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const i3 = i * 3, phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2;
            positions[i3] = radius * Math.cos(theta) * Math.sin(phi);
            positions[i3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
            positions[i3 + 2] = radius * Math.cos(phi);
            const color = colors[Math.floor(Math.random() * colors.length)];
            colorsArr.set([color.r, color.g, color.b], i3);
            sizes[i] = Math.random() * (maxSize - minSize) + minSize;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colorsArr, 3));
        geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
        const mat = makeMat({ map: circleTexture, blending: THREE.AdditiveBlending, depthWrite: false, opacity, sizeAttenuation: false, vertexColors: true });
        return new THREE.Points(geo, mat);
    };

    const starColors = [new THREE.Color(0xffffff), new THREE.Color(0xaae2ff), new THREE.Color(0xffffd0), new THREE.Color(0xffd0aa)];
    starLayers.push(
        createStarLayer({ count: 6000, radius: 250, colors: [new THREE.Color(0xaae2ff), new THREE.Color(0xffffff)], minSize: 0.5, maxSize: 1.5, opacity: 0.8 }),
        createStarLayer({ count: 3000, radius: 180, colors: starColors, minSize: 1, maxSize: 2.5, opacity: 1 }),
        createStarLayer({ count: 1000, radius: 120, colors: starColors, minSize: 1.5, maxSize: 4, opacity: 1.2 })
    );
    starLayers.forEach(layer => scene.add(layer));
}

function createCosmicDust(scene) {
    const dustCount = 50, positions = new Float32Array(dustCount * 3), colors = new Float32Array(dustCount * 3), velocities = new Float32Array(dustCount);
    const dustColor = new THREE.Color(0xffffff);
    for (let i = 0; i < dustCount; i++) {
        const i3 = i * 3, r = 200 * Math.random() + 50, phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2;
        positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)], i3);
        const brightness = 0.5 * Math.random() + 0.5;
        colors.set([dustColor.r * brightness, dustColor.g * brightness, dustColor.b * brightness], i3);
        velocities[i] = 0.5 + Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7 });
    cosmicDust = new THREE.Points(geo, mat);
    cosmicDust.userData.velocities = velocities;
    scene.add(cosmicDust);
}

function createShootingStars(scene, circleTexture) {
    const starCount = 10;
    const tailPositions = new Float32Array(starCount * (TAIL_LENGTH + 1) * 3);
    const tailAlphas = new Float32Array(starCount * (TAIL_LENGTH + 1)).fill(0);
    const tailColors = new Float32Array(starCount * (TAIL_LENGTH + 1) * 3);
    const tailSizes = new Float32Array(starCount * (TAIL_LENGTH + 1));
    
    for (let i = 0; i < starCount; i++) {
        const headIndex = i * (TAIL_LENGTH + 1);
        tailSizes[headIndex] = 6;
        tailColors.set([1, 1, 1], headIndex * 3);
        for (let j = 1; j <= TAIL_LENGTH; j++) {
            const ratio = 1 - j / TAIL_LENGTH;
            tailSizes[headIndex + j] = 4 * ratio;
            tailColors.set([0.7 * ratio, 0.8 * ratio, 1 * ratio], (headIndex + j) * 3);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(tailPositions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(tailColors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("size", new THREE.BufferAttribute(tailSizes, 1));
    geo.setAttribute("alpha", new THREE.BufferAttribute(tailAlphas, 1).setUsage(THREE.DynamicDrawUsage));
    
    // Lưu lại màu gốc để có thể phục hồi
    geo.userData.originalColors = new Float32Array(tailColors);

    const mat = makeMat({ map: circleTexture, blending: THREE.AdditiveBlending, depthWrite: false, alphaSupport: true, vertexColors: true, opacity: 2, sizeAttenuation: false });
    shootingStars = new THREE.Points(geo, mat);
    shootingStars.userData = {
        velocities: new Float32Array(starCount * 3), birthTimes: new Float32Array(starCount),
        lifespans: new Float32Array(starCount).fill(0), alphas: new Float32Array(starCount).fill(0)
    };
    scene.add(shootingStars);
}

export async function createBackground(scene, circleTexture) {
    await createTextureStars(scene);
    createPointStars(scene, circleTexture);
    createCosmicDust(scene);
    createShootingStars(scene, circleTexture);
}

export function updateBackground(elapsedTime, delta) {
    if(starGroup) {
        starGroup.children.forEach(group => group.material.uniforms.uTime.value = elapsedTime);
        starGroup.rotation.y += 0.0001;
    }
    if (starLayers.length > 0) {
        starLayers[0].rotation.y += 0.00005; starLayers[1].rotation.y += 0.0001; starLayers[2].rotation.y += 0.00015;
    }
    if (cosmicDust) {
        const positions = cosmicDust.geometry.attributes.position.array, velocities = cosmicDust.userData.velocities;
        for (let i = 0; i < velocities.length; i++) {
            const i3 = i * 3;
            positions[i3 + 1] -= velocities[i] * delta * 50;
            if (positions[i3 + 1] < -250) {
                positions[i3 + 1] = 250;
                const r = 200*Math.random()+50, theta = Math.random()*Math.PI*2, phi = Math.acos(2*Math.random()-1);
                positions.set([r*Math.sin(phi)*Math.cos(theta), 250, r*Math.sin(phi)*Math.sin(theta)], i3);
            }
        }
        cosmicDust.geometry.attributes.position.needsUpdate = true;
    }
    if (shootingStars && elapsedTime >= nextShootTime) {
        const { velocities, birthTimes, lifespans, alphas } = shootingStars.userData;
        for (let i = 0; i < 10; i++) {
            if (lifespans[i] <= 0) {
                const startPos = new THREE.Vector3().randomDirection().normalize().multiplyScalar(200);
                const velocity = new THREE.Vector3().crossVectors(startPos, new THREE.Vector3().randomDirection()).normalize();
                const speed = 60 + 40 * Math.random(); 
                velocities.set([velocity.x * speed, velocity.y * speed, velocity.z * speed], i * 3);
                const headPosIndex = i * (TAIL_LENGTH + 1) * 3;
                shootingStars.geometry.attributes.position.array.set([startPos.x, startPos.y, startPos.z], headPosIndex);
                birthTimes[i] = elapsedTime; 
                lifespans[i] = SHOOTING_STAR_LIFESPAN; 
                alphas[i] = 0.8 + 0.2 * Math.random();
                break;
            }
        }
        nextShootTime = elapsedTime + 0.5 + Math.random();
    }
    if (shootingStars) {
        const { velocities, birthTimes, lifespans, alphas } = shootingStars.userData;
        const positions = shootingStars.geometry.attributes.position.array;
        const tailAlphas = shootingStars.geometry.attributes.alpha.array;
        const tailColors = shootingStars.geometry.attributes.color.array;
        const originalColors = shootingStars.geometry.userData.originalColors;

        for (let i = 0; i < 10; i++) {
            if (lifespans[i] > 0) {
                const headIndex = i * (TAIL_LENGTH + 1), i3 = i*3;
                const lifeProgress = (elapsedTime - birthTimes[i]) / lifespans[i];

                if (lifeProgress >= 1) {
                    lifespans[i] = 0;
                    for (let j=0; j<=TAIL_LENGTH; j++) tailAlphas[headIndex + j] = 0;
                } else {
                    const newPos = [positions[headIndex*3] + velocities[i3]*delta, positions[headIndex*3+1] + velocities[i3+1]*delta, positions[headIndex*3+2] + velocities[i3+2]*delta];
                    positions.set(newPos, headIndex*3);
                    
                    const appearDuration = 0.2;
                    const disappearStart = 0.5;
                    
                    const visibleLength = (lifeProgress < appearDuration)
                        ? TAIL_LENGTH * (lifeProgress / appearDuration)
                        : TAIL_LENGTH;

                    const disappearStartPoint = (lifeProgress > disappearStart)
                        ? TAIL_LENGTH * ((lifeProgress - disappearStart) / (1.0 - disappearStart))
                        : 0;

                    for (let j = 0; j <= TAIL_LENGTH; j++) {
                        const isVisible = (j <= visibleLength && j >= disappearStartPoint);
                        const currentIndex = headIndex + j;
                        const colorIndex = currentIndex * 3;
                        
                        if (isVisible) {
                            // Phục hồi màu gốc
                            tailColors[colorIndex] = originalColors[colorIndex];
                            tailColors[colorIndex + 1] = originalColors[colorIndex + 1];
                            tailColors[colorIndex + 2] = originalColors[colorIndex + 2];
                            
                            // Phục hồi alpha gốc
                            const tailRatio = j / TAIL_LENGTH;
                            const baseAlpha = (j === 0) ? alphas[i] : alphas[i] * (1 - tailRatio);
                            tailAlphas[currentIndex] = baseAlpha;
                        } else {
                            // "Sơn đen" hạt để tạo hiệu ứng bị che khuất
                            tailColors[colorIndex] = 0;
                            tailColors[colorIndex + 1] = 0;
                            tailColors[colorIndex + 2] = 0;
                            // Alpha vẫn là 1 để đảm bảo nó là một chấm đen che lấp, không phải trong suốt
                            tailAlphas[currentIndex] = 1; 
                        }
                        
                        if (j > 0) {
                           const ratio = j / TAIL_LENGTH;
                           positions.set([newPos[0] - velocities[i3]*ratio*0.3, newPos[1] - velocities[i3+1]*ratio*0.3, newPos[2] - velocities[i3+2]*ratio*0.3], (headIndex + j) * 3);
                        }
                    }
                }
            }
        }
        shootingStars.geometry.attributes.position.needsUpdate = true;
        shootingStars.geometry.attributes.alpha.needsUpdate = true;
        shootingStars.geometry.attributes.color.needsUpdate = true; // Rất quan trọng!
    }
}