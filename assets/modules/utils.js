// File: assets/modules/utils.js
import * as THREE from "three";

export function makeMat({
  map = null, color = 0xffffff, transparent = true, vertexColors = true,
  sizeAttenuation = true, alphaSupport = false, clipBandWidth = 0,
  vClipSlope = 0, clipFrontZ = 0.1, blending = THREE.NormalBlending,
  opacity = 1, depthWrite = true,
} = {}) {
  const material = new THREE.PointsMaterial({
    map, color, transparent, vertexColors, sizeAttenuation,
    blending, opacity, depthWrite,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "uniform float size;",
      `
      attribute float size;
      ${alphaSupport ? "attribute float alpha;\nvarying float vAlpha;" : ""}
      ${clipBandWidth > 0 || vClipSlope > 0 ? "varying vec3 vViewPos;" : ""}
      `
    );
    let vertexMainAddition = "";
    if (clipBandWidth > 0 || vClipSlope > 0) vertexMainAddition += "vViewPos = mvPosition.xyz;\n";
    if (alphaSupport) vertexMainAddition += "vAlpha = alpha;\n";
    if (vertexMainAddition) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>\n${vertexMainAddition}`
      );
    }
    if (alphaSupport) {
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying float vAlpha;\nvoid main() {")
        .replace(
          "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
          "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
        );
    }
    if (clipBandWidth > 0 || vClipSlope > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "varying vec3 vViewPos;\nvoid main() {"
      );
      let clippingCode = "";
      if (clipBandWidth > 0) {
        clippingCode += `if (vViewPos.z < -${clipBandWidth.toFixed(3)} && abs(vViewPos.x) < ${clipFrontZ.toFixed(3)}) discard;`;
      }
      if (vClipSlope > 0) {
        clippingCode += `if (abs(vViewPos.x) < ${clipFrontZ.toFixed(3)} && vViewPos.z < -${vClipSlope.toFixed(3)} * (-vViewPos.z)) discard;`;
      }
      const insertionPoint = alphaSupport ?
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );" :
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";
      if (clippingCode) {
        shader.fragmentShader = shader.fragmentShader.replace(
          insertionPoint,
          `${clippingCode}\n  ${insertionPoint}`
        );
      }
    }
  };
  return material;
}

export function generateGlowCircleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(128, 128, 50.8, 128, 128, 127);
    gradient.addColorStop(0, "rgba(255,105,180,0.6)");
    gradient.addColorStop(1, "rgba(255,20,147,0)");
    context.fillStyle = gradient;
    context.arc(128, 128, 127, 0, 2 * Math.PI);
    context.fill();
    const coreGradient = context.createRadialGradient(128, 128, 0, 128, 128, 76.2);
    coreGradient.addColorStop(0, "rgba(255,255,255,1)");
    coreGradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = coreGradient;
    context.arc(128, 128, 76.2, 0, 2 * Math.PI);
    context.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}