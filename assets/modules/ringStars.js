// File: assets/modules/ringStars.js (Đồng bộ với main.js)
import * as THREE from "three";

const STAR_COUNT = 15;
let starSprites = [];
let starImages = [];
const quaternion = new THREE.Quaternion();

// Hàm tạo các ngôi sao tương tác
export function createRingStars(scene, appData) {
    const textureLoader = new THREE.TextureLoader();
    // Bạn có thể đổi lại thành 'ring1.jpg' nếu muốn
    const starTexture = textureLoader.load('./assets/ring.png'); 
    
    starImages = appData.images || [];
    const radius = 70;

    for (let i = 0; i < STAR_COUNT; i++) {
        const material = new THREE.SpriteMaterial({
            map: starTexture,
            blending: THREE.AdditiveBlending,
            color: 0xffddaa,
            transparent: true,
            opacity: 2, // Bạn đã đặt giá trị này trong file cũ
            depthWrite: false,
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(5, 5, 1); 

        const phi = Math.acos(-1 + (2 * i) / STAR_COUNT);
        const theta = Math.sqrt(STAR_COUNT * Math.PI) * phi;
        sprite.position.setFromSphericalCoords(radius, phi, theta);
        sprite.position.add(new THREE.Vector3(0, 10, 0));

        sprite.userData = {
            index: i,
            imageSrc: starImages.length > 0 ? starImages[i % starImages.length] : null,
            rotationAxis: new THREE.Vector3().randomDirection().normalize(),
            speed: 0.05 + Math.random() * 0.1, // Giữ lại tốc độ chậm
            twinkleSpeed: 1.5 + Math.random(),
            twinkleOffset: Math.random() * Math.PI * 2,
        };
        
        starSprites.push(sprite);
        scene.add(sprite);
    }

    return starSprites;
}

// Hàm cập nhật vị trí và độ sáng của các ngôi sao
// Hàm này giờ nhận cả 2 tham số để hoạt động chính xác
export function updateRingStars(elapsedTime, delta) { 
    if (starSprites.length === 0) return;

    const center = new THREE.Vector3(0, 10, 0);

    starSprites.forEach(sprite => {
        const { rotationAxis, speed, twinkleSpeed, twinkleOffset } = sprite.userData;
        
        // Chuyển động trôi nổi dùng 'delta' để mượt mà và đúng tốc độ
        sprite.position.sub(center);
        quaternion.setFromAxisAngle(rotationAxis, speed * delta);
        sprite.position.applyQuaternion(quaternion);
        sprite.position.add(center);

        // Hiệu ứng nhấp nháy dùng 'elapsedTime' để có chu kỳ đều đặn
        const twinkleFactor = (Math.sin(elapsedTime * twinkleSpeed + twinkleOffset) + 1) / 2;
        
        // Trong file bạn gửi, opacity là 2, tôi sẽ giữ lại logic nhấp nháy dựa trên đó
        // Dao động từ 1.0 đến 2.0
        sprite.material.opacity = 1.0 + 1.0 * twinkleFactor;

        const baseScale = 5;
        const dynamicScale = baseScale * (0.9 + 0.1 * twinkleFactor);
        sprite.scale.set(dynamicScale, dynamicScale, 1);
    });
}