// File: assets/modules/sceneSetup.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";

function applyMobileSettings(renderer) {
    if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement("meta");
        meta.name = "viewport";
        meta.content = "width=device-width, initial-scale=1.0, user-scalable=no";
        document.head.appendChild(meta);
    }
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
}

export function setupScene() {
    const scene = new THREE.Scene();
    const heartScene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    applyMobileSettings(renderer);
    
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 90, 25);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 250;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const p1 = new THREE.PointLight(0xffffff, 1.2);
    p1.position.set(10, 10, 10);
    scene.add(p1);

    const composerMain = new EffectComposer(renderer);
    const renderPassMain = new RenderPass(scene, camera);
    renderPassMain.clear = false;
    composerMain.addPass(renderPassMain);

    const composerHeart = new EffectComposer(renderer);
    composerHeart.addPass(new RenderPass(heartScene, camera));
    const afterimagePass = new AfterimagePass();
    afterimagePass.uniforms["damp"].value = 0.9;
    composerHeart.addPass(afterimagePass);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composerMain.setSize(window.innerWidth, window.innerHeight);
        composerHeart.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, heartScene, camera, renderer, controls, composerMain, composerHeart };
}