// File: assets/modules/dataManager.js
function applyCss() {
    const appStyles = `html, body { background: #000 !important; color-scheme: dark; margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: Arial, sans-serif; position: fixed; width: 100%; top: 0; left: 0; } body { background: #000; background: radial-gradient(circle, #111 0%, #000 100%); } canvas { display: block; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; } #musicToggle { position: fixed; top: 16px; right: 16px; font-size: 22px; background: rgba(255, 255, 255, 0); border: 1px solid #ccc; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 999; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); transition: background 0.3s ease; }`;
    const styleElement = document.createElement("style");
    styleElement.innerHTML = appStyles;
    document.head.appendChild(styleElement);
}

function setupMusicPlayer(musicUrl) {
    const audio = new Audio(musicUrl);
    audio.loop = true;
    const button = document.createElement("button");
    button.id = "musicToggle";
    button.innerHTML = '<i class="fas fa-volume-high"></i>';
    document.body.appendChild(button);

    let isPlaying = false;
    const updateIcon = () => {
        button.innerHTML = `<i class="fas ${isPlaying ? "fa-volume-high" : "fa-volume-xmark"}"></i>`;
    };

    const playMusic = () => {
        audio.play().then(() => { isPlaying = true; updateIcon(); }).catch(() => {});
    };
    const pauseMusic = () => {
        audio.pause(); isPlaying = false; updateIcon();
    };

    button.addEventListener("click", () => isPlaying ? pauseMusic() : playMusic());
    audio.play().then(() => { isPlaying = true; updateIcon(); }).catch(() => {
        const playOnClick = () => {
            playMusic();
            document.removeEventListener("click", playOnClick);
        };
        document.addEventListener("click", playOnClick);
    });
}

export function loadDataFromURL() {
    applyCss();
    let appData = {
        messages: ["😭","Chào con vợ", "anh yêu con vợ vl", "mãi bên nhau nhé con heo thon thả của anh", "❤️",  ],
        images: [],
        heartColor: "#ff9090",
        music: null,
    };

    const dataParam = new URLSearchParams(window.location.search).get("data");
    if (dataParam) {
        try {
            const decodedString = decodeURIComponent(escape(atob(dataParam)));
            const parsedData = JSON.parse(decodedString);
            appData = { ...appData, ...parsedData };
        } catch (error) {
            console.error("Dữ liệu từ URL không hợp lệ:", error);
        }
    } else if (window.Heartlove && window.Heartlove.data) {
         appData = { ...appData, ...window.Heartlove.data };
    }
    
    if (appData.music) {
        setupMusicPlayer(appData.music);
    }
    return appData;
}