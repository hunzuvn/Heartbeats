// File: assets/main.js (Thêm hiệu ứng hover cho con trỏ chuột)
import * as THREE from "three";
import { loadDataFromURL } from './modules/dataManager.js';
import { setupScene } from './modules/sceneSetup.js';
import { generateGlowCircleTexture } from './modules/utils.js';
import { createBackground, updateBackground } from './modules/background.js';
import { createHeart, updateHeart } from './modules/heart.js';
import { createParticleStream, updateParticleStream } from './modules/particleStream.js';
import { createImageManager, updateImageManager } from './modules/imageManager.js';
import { createTextEffects, updateTextEffects } from './modules/textEffects.js';
import { createRingStars, updateRingStars } from './modules/ringStars.js';

function showImageOverlay(imageSrc, startEvent) {
    const oldOverlay = document.getElementById('image-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'image-overlay';
    const image = document.createElement('img');
    image.className = 'image-popup';
    image.src = imageSrc;
    const closeButton = document.createElement('div');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';

    overlay.appendChild(image);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);

    image.style.setProperty('--start-x', `${startEvent.clientX}px`);
    image.style.setProperty('--start-y', `${startEvent.clientY}px`);

    requestAnimationFrame(() => {
        overlay.classList.add('visible');
    });

    const closeOverlay = (e) => {
        if (e.target !== image) {
            overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        }
    };
    overlay.addEventListener('click', closeOverlay);
    closeButton.addEventListener('click', closeOverlay);
}

class App {
    constructor() {
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster(); 
        this.pointer = new THREE.Vector2();   
        
        this.appState = {
            isPulsing: false, pulseStartTime: 0, heartbeatEnabled: false,
            streamHeartStarted: false, elapsedTime: 0, useCustomColor: false,
        };
        this.init();
    }

    async init() {
        this.appData = loadDataFromURL();
        this.appState.useCustomColor = /^#([A-Fa-f0-9]{8}|[A-Fa-f0-9]{6})$/.test(this.appData.heartColor);
        
        this.threeContext = setupScene();
        const circleTexture = generateGlowCircleTexture();

        await createBackground(this.threeContext.scene, circleTexture);
        this.heart = createHeart(this.threeContext.heartScene, this.appData.heartColor, circleTexture);
        this.heart.data.circleTexture = circleTexture;
        this.stream = createParticleStream(this.threeContext.scene, this.heart.data, this.appData.heartColor);
        this.text = createTextEffects(this.threeContext.scene, this.stream.streamHeart, this.appData, this.heart.data);
        this.image = await createImageManager(this.stream.streamHeart, this.appData);
        this.ringStars = createRingStars(this.threeContext.scene, this.appData);

        this.appState.heartbeatEnabled = true;
        this.appState.streamHeartStarted = true;
        
        // Thêm cả 2 bộ lắng nghe sự kiện: 1 cho click, 1 cho di chuyển chuột
        window.addEventListener('pointerdown', this.onPointerDown.bind(this));
        window.addEventListener('pointermove', this.onPointerMove.bind(this)); // Dòng mới

        this.clock.getDelta();
        this.animate();
    }

    // --- LOGIC MỚI: HÀM XỬ LÝ KHI DI CHUYỂN CHUỘT ---
    onPointerMove(event) {
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.threeContext.camera);

        const intersects = this.raycaster.intersectObjects(this.ringStars);

        // Nếu chuột đang trỏ vào một ngôi sao, đổi con trỏ thành hình bàn tay
        if (intersects.length > 0) {
            document.body.style.cursor = 'pointer';
        } else {
            // Nếu không, trả về con trỏ mặc định
            document.body.style.cursor = 'auto';
        }
    }

    onPointerDown(event) {
        // Hàm này giữ nguyên như cũ để xử lý click
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.threeContext.camera);

        const intersects = this.raycaster.intersectObjects(this.ringStars);

        if (intersects.length > 0) {
            event.stopPropagation(); 
            const clickedStar = intersects[0].object;
            if (clickedStar.userData.imageSrc) {
                showImageOverlay(clickedStar.userData.imageSrc, event);
            }
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta(), elapsedTime = this.clock.getElapsedTime();
        this.appState.elapsedTime = elapsedTime;

        updateBackground(elapsedTime, delta);
        updateHeart(this.heart.elements, this.heart.data, elapsedTime, this.threeContext.controls, this.appState, this.appData.heartColor);
        updateParticleStream(this.stream, this.heart, this.image, this.text, elapsedTime, this.appState);
        updateImageManager(this.stream, this.image, elapsedTime * 1000);
        updateTextEffects(this.text, this.stream, elapsedTime);
        updateRingStars(elapsedTime, delta);
        
        this.threeContext.controls.update();

        const { renderer, composerMain, composerHeart } = this.threeContext;
        renderer.clear(); composerHeart.render();
        renderer.clearDepth(); renderer.autoClear = false;
        composerMain.render(); renderer.autoClear = true;
    }
}


(async () => {
  const res = await fetch('/version.txt', { cache: 'no-store' });
  const latestVersion = await res.text();
  const currentVersion = localStorage.getItem('site_version');

  if (currentVersion && currentVersion !== latestVersion.trim()) {
    localStorage.removeItem('site_version');
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
    location.reload(true);
  } else {
    localStorage.setItem('site_version', latestVersion.trim());
  }
})();


new App();