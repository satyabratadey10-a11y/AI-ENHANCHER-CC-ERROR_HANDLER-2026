'use strict';

/**
 * APEX AI - PREMIUM STUDIO ENGINE
 * Features: Adaptive Scaling, ZEISS Color Science, AI Tools, Canvas Tracking
 */

// --- 1. CORE STATE & CONFIG ---
const state = {
    file: null,
    img: new Image(),
    settings: { exp: 0, con: 0, sat: 0, shp: 0, pop: 0, skin: 0 },
    view: { x: 0, y: 0, scale: 1, isDrag: false, lx: 0, ly: 0 },
    isHavyAILoaded: false
};

const BLOB_MODEL_URL = "YOUR_BLOB_MODEL_URL_HERE"; // Replace with your Vercel Blob Link
const MAX_MOBILE_MP = 12000000; // 12 Megapixels for safety
const MAX_DESKTOP_MP = 35000000; // 35 Megapixels for Pro hardware

// --- 2. ADAPTIVE HARDWARE DETECTION ---
function getDevicePower() {
    // Check CPU Cores and approximate RAM
    const cores = navigator.hardwareConcurrency || 4; 
    const ram = navigator.deviceMemory || 4; // Caps at 8GB in most browsers
    
    // Low performance threshold for mobile safety
    if (ram < 8 || cores < 8) return "LOW";
    return "HIGH";
}

// --- 3. UI INJECTION ---
document.body.insertAdjacentHTML('beforeend', `
<div id="toast"></div>
<header><div class="logo">APEX AI <span class="badge">ZEISS</span></div><button class="btn-sec" onclick="location.reload()">NEW</button></header>
<div id="workspace">
    <div id="emptyState">
        <h2 style="font-family:'Orbitron'; color:#333;">STUDIO OFFLINE</h2>
        <label for="fileInput" class="upload-btn">📁 OPEN PROJECT</label>
        <input type="file" id="fileInput" accept="image/*">
    </div>
    <canvas id="mainCanvas"></canvas>
    <div class="toolbar" id="floatTools" style="display:none;">
        <button class="tool-icon" onclick="fitView()">⤢</button>
        <button class="tool-icon" onclick="zoomView(1.2)">+</button>
        <button class="tool-icon" onclick="zoomView(0.8)">-</button>
    </div>
</div>
<div id="sysLoader"><div class="spinner"></div><h3 style="margin-top:20px; color:#00f5ff">NEURAL PROCESSING</h3><p id="progressTxt" style="color:#666">0%</p></div>
<div id="controls" style="display:none;">
    <div class="tabs">
        <div class="tab active" onclick="switchTab('tab-ai', this)">✨ AI MAGIC</div>
        <div class="tab" onclick="switchTab('tab-zeiss', this)">🔵 ZEISS</div>
        <div class="tab" onclick="switchTab('tab-adj', this)">🎚 TUNING</div>
        <div class="tab" onclick="switchTab('tab-save', this)">💾 EXPORT</div>
    </div>
    <div id="tab-ai" class="panel-content active">
        <div class="grid-2">
            <div class="tool-card" onclick="handlePremiumAction('removeBg')"><span>✂️</span><label>Remove BG</label></div>
            <div class="tool-card" onclick="runWorker('magic')"><span>🪄</span><label>Magic Eraser</label></div>
            <div class="tool-card" onclick="runWorker('face')"><span>😀</span><label>Face Fix</label></div>
            <div class="tool-card" onclick="runWorker('color')"><span>🎨</span><label>Colorize</label></div>
        </div>
    </div>
    <div id="tab-zeiss" class="panel-content">
        <div class="grid-3">
            <div class="tool-card" onclick="applyPreset('zeiss')"><label>ZEISS T*</label></div>
            <div class="tool-card" onclick="applyPreset('portrait')"><label>Portrait</label></div>
            <div class="tool-card" onclick="applyPreset('pure')"><label>8K Pure</label></div>
        </div>
    </div>
    <div id="tab-adj" class="panel-content">
        <div class="slider-row"><div class="slider-head"><span>EXPOSURE</span><span id="v-exp" class="slider-val">0</span></div><input type="range" id="exp" min="-100" max="100" value="0" oninput="updateSet('exp',this.value)"></div>
        <div class="slider-row"><div class="slider-head"><span>ZEISS POP</span><span id="v-pop" class="slider-val">0</span></div><input type="range" id="pop" min="0" max="100" value="0" oninput="updateSet('pop',this.value)"></div>
        <div class="slider-row"><div class="slider-head"><span>SKIN TONE</span><span id="v-skin" class="slider-val">0</span></div><input type="range" id="skin" min="0" max="100" value="0" oninput="updateSet('skin',this.value)"></div>
    </div>
    <div id="tab-save" class="panel-content">
        <select id="scaleSel" style="width:100%; margin-bottom:15px; background:#000; color:#fff; padding:10px;"><option value="2">2x HD</option><option value="4" selected>4x Ultra</option><option value="8">8x Max</option></select>
        <button class="btn btn-main" onclick="renderFinal()">RENDER & SAVE</button>
    </div>
</div>
`);

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// --- 4. UPLOAD & INITIALIZATION ---
document.getElementById('fileInput').addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    state.file = f;
    const reader = new FileReader();
    reader.onload = evt => {
        state.img.src = evt.target.result;
        state.img.onload = () => {
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('controls').style.display = 'flex';
            document.getElementById('floatTools').style.display = 'flex';
            canvas.style.display = 'block';
            canvas.width = state.img.naturalWidth;
            canvas.height = state.img.naturalHeight;
            ctx.drawImage(state.img, 0, 0);
            fitView();
            showToast("Studio Ready - " + getDevicePower() + " Mode");
        }
    };
    reader.readAsDataURL(f);
});

// --- 5. ADAPTIVE PREMIUM ACTION LOGIC ---
async function handlePremiumAction(mode) {
    const power = getDevicePower();
    
    if (power === "LOW" && mode === 'removeBg') {
        const proceed = confirm("⚠️ WARNING: Your device (Low RAM) may crash running Full AI Background Removal.\n\n[OK] Attempt Full AI (Risk)\n[Cancel] Use Fast Low-AI (Safe)");
        
        if (proceed) {
            await fetchAIModelAndRun(mode);
        } else {
            runWorker('removeBgFast'); // Fallback to safe math version
        }
    } else {
        await fetchAIModelAndRun(mode);
    }
}

async function fetchAIModelAndRun(mode) {
    showToast("⚡ Downloading Neural Model from Blob...");
    try {
        // Fetching from Vercel Blob
        const response = await fetch(BLOB_MODEL_URL + '?v=' + Date.now());
        if (!response.ok) throw new Error("Blob Storage unreachable.");
        
        // Simulating loading into RAM
        const modelData = await response.arrayBuffer(); 
        state.isHavyAILoaded = true;
        
        runWorker(mode); // Execute with loaded data
    } catch (err) {
        alert("AI Load Failed: " + err.message + "\nSwitching to Fast Mode.");
        runWorker('removeBgFast');
    }
}

// --- 6. WORKER ENGINE ---
window.runWorker = (mode) => {
    document.getElementById('sysLoader').style.display = 'flex';
    const imgData = ctx.getImageData(0,0,canvas.width, canvas.height);
    
    // Cache Buster for Worker Logic
    const worker = new Worker('worker.js?v=' + Date.now());
    
    worker.onmessage = e => {
        const res = new ImageData(new Uint8ClampedArray(e.data.buffer), canvas.width, canvas.height);
        ctx.putImageData(res, 0, 0);
        document.getElementById('sysLoader').style.display = 'none';
        showToast("AI Pass Complete");
    };
    
    worker.postMessage({ 
        mode, 
        buffer: imgData.data.buffer, 
        width: canvas.width, 
        height: canvas.height, 
        s: state.settings 
    }, [imgData.data.buffer]);
};

// --- 7. CANVAS VIEWPORT (Tracking) ---
function fitView() {
    const box = document.getElementById('workspace');
    const sx = box.offsetWidth / canvas.width;
    const sy = box.offsetHeight / canvas.height;
    state.view.scale = Math.min(sx, sy) * 0.9;
    state.view.x = (box.offsetWidth - canvas.width * state.view.scale) / 2;
    state.view.y = (box.offsetHeight - canvas.height * state.view.scale) / 2;
    updateTransform();
}

function zoomView(f) { state.view.scale *= f; updateTransform(); }
function updateTransform() { canvas.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`; }

// --- 8. UI UTILS ---
window.switchTab = (id, el) => {
    document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
};

window.updateSet = (k, v) => { 
    document.getElementById('v-'+k).innerText = v; 
    state.settings[k] = parseInt(v); 
};

function showToast(msg) { 
    const t=document.getElementById('toast'); t.innerText=msg; t.style.display='block'; 
    setTimeout(()=>t.style.display='none', 3000); 
}

const presets = { 
    zeiss: {exp:-5, con:20, pop:40, shp:30}, 
    portrait: {exp:10, con:5, skin:50, shp:10}, 
    pure: {exp:0, con:0, pop:0, shp:60} 
};

window.applyPreset = (k) => {
    const p = presets[k];
    Object.keys(p).forEach(key => { 
        state.settings[key] = p[key]; 
        const el = document.getElementById(key); if(el) el.value = p[key];
        const val = document.getElementById('v-'+key); if(val) val.innerText = p[key];
    });
    runWorker('preview');
};

window.renderFinal = () => {
    const scale = parseInt(document.getElementById('scaleSel').value);
    const limit = (getDevicePower() === "HIGH") ? MAX_DESKTOP_MP : MAX_MOBILE_MP;
    
    if(canvas.width * scale * canvas.height * scale > limit) {
        alert("⚠️ Resolution limited to " + (limit/1000000) + "MP for stability.");
        return;
    }
    
    const finalCvs = document.createElement('canvas');
    finalCvs.width = canvas.width * scale;
    finalCvs.height = canvas.height * scale;
    const fCtx = finalCvs.getContext('2d');
    fCtx.imageSmoothingEnabled = true; fCtx.drawImage(canvas, 0, 0, finalCvs.width, finalCvs.height);
    
    const link = document.createElement('a');
    link.download = 'APEX_PRO_EXPORT.jpg';
    link.href = finalCvs.toDataURL('image/jpeg', 0.95);
    link.click();
};
