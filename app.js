// --- HTML STRUCTURE INJECTION ---
document.body.insertAdjacentHTML('beforeend', `
<div id="toast"></div>
<header><div class="logo">APEX AI <span class="badge">ULTRA</span></div><button class="btn-sec" onclick="location.reload()">NEW</button></header>
<div id="workspace">
    <div id="emptyState">
        <h2 style="color:#333;">NO IMAGE</h2>
        <label for="fileInput" class="upload-btn">📁 OPEN STUDIO</label>
        <input type="file" id="fileInput" accept="image/*">
    </div>
    <canvas id="mainCanvas"></canvas>
</div>
<div id="sysLoader"><div class="spinner"></div><h3 style="margin-top:20px; color:#00f5ff">PROCESSING</h3><p id="progressTxt" style="color:#666">0%</p></div>
<div id="controls">
    <div class="tabs">
        <div class="tab active" onclick="switchTab('tab-ai', this)">✨ AI TOOLS</div>
        <div class="tab" onclick="switchTab('tab-adj', this)">🎚 ADJUST</div>
        <div class="tab" onclick="switchTab('tab-zeiss', this)">🔵 ZEISS</div>
        <div class="tab" onclick="switchTab('tab-save', this)">💾 EXPORT</div>
    </div>
    <div id="tab-ai" class="panel-content active">
        <div class="grid-2">
            <div class="tool-card" onclick="runWorker('removeBg')"><span>✂️</span><label>Remove BG</label></div>
            <div class="tool-card" onclick="runWorker('magic')"><span>🪄</span><label>Magic Eraser</label></div>
            <div class="tool-card" onclick="runWorker('color')"><span>🎨</span><label>Colorize</label></div>
            <div class="tool-card" onclick="runWorker('face')"><span>😀</span><label>Face Fix</label></div>
        </div>
    </div>
    <div id="tab-adj" class="panel-content">
        <div class="slider-row"><div class="slider-head"><span>EXPOSURE</span><span id="v-exp" class="slider-val">0</span></div><input type="range" id="exp" min="-100" max="100" value="0" oninput="updateSet('exp',this.value)"></div>
        <div class="slider-row"><div class="slider-head"><span>CONTRAST</span><span id="v-con" class="slider-val">0</span></div><input type="range" id="con" min="-100" max="100" value="0" oninput="updateSet('con',this.value)"></div>
        <div class="slider-row"><div class="slider-head"><span>SATURATION</span><span id="v-sat" class="slider-val">0</span></div><input type="range" id="sat" min="-100" max="100" value="0" oninput="updateSet('sat',this.value)"></div>
        <div class="slider-row"><div class="slider-head"><span>SHARPNESS</span><span id="v-shp" class="slider-val">0</span></div><input type="range" id="shp" min="0" max="100" value="0" oninput="updateSet('shp',this.value)"></div>
    </div>
    <div id="tab-zeiss" class="panel-content">
        <div class="grid-3">
            <div class="tool-card" onclick="applyPreset('zeiss')"><label>ZEISS T*</label></div>
            <div class="tool-card" onclick="applyPreset('portrait')"><label>Portrait</label></div>
            <div class="tool-card" onclick="applyPreset('cine')"><label>Cinema</label></div>
            <div class="tool-card" onclick="applyPreset('bw')"><label>Leica B&W</label></div>
            <div class="tool-card" onclick="applyPreset('vivid')"><label>Vivid+</label></div>
            <div class="tool-card" onclick="applyPreset('pure')"><label>Pure 8K</label></div>
        </div>
    </div>
    <div id="tab-save" class="panel-content">
        <div class="slider-row">
            <div class="slider-head"><span>UPSCALE</span><span class="slider-val" id="scaleDisplay">4x</span></div>
            <select id="scaleSel" style="width:100%; background:#000; color:#fff; padding:8px; border:1px solid #333;"><option value="2">2x</option><option value="4" selected>4x</option><option value="8">8x</option></select>
        </div>
        <button class="btn btn-main" style="width:100%; padding:15px;" onclick="renderFinal()">RENDER & DOWNLOAD</button>
    </div>
    <div class="actions"><button class="btn btn-sec" onclick="runWorker('auto')">✨ AUTO</button><button class="btn btn-main" onclick="runWorker('preview')">APPLY</button></div>
</div>
`);

// --- LOGIC ---
const state = { file: null, img: new Image(), settings: { exp:0, con:0, sat:0, shp:0 }, view: { x:0, y:0, scale:1, isDrag:false, lx:0, ly:0 } };
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// Upload
document.getElementById('fileInput').addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    state.file = f;
    const r = new FileReader();
    r.onload = evt => {
        state.img.src = evt.target.result;
        state.img.onload = () => {
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('controls').style.display = 'flex';
            canvas.style.display = 'block';
            canvas.width = state.img.naturalWidth;
            canvas.height = state.img.naturalHeight;
            ctx.drawImage(state.img, 0, 0);
            fitView();
            showToast("✅ Ready");
        }
    };
    r.readAsDataURL(f);
});

// Canvas View
function fitView() {
    const box = document.getElementById('workspace');
    const sx = box.offsetWidth / canvas.width;
    const sy = box.offsetHeight / canvas.height;
    state.view.scale = Math.min(sx, sy) * 0.9;
    state.view.x = (box.offsetWidth - canvas.width * state.view.scale) / 2;
    state.view.y = (box.offsetHeight - canvas.height * state.view.scale) / 2;
    updateTransform();
}
function updateTransform() { canvas.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`; }

// UI
window.switchTab = (id, el) => {
    document.querySelectorAll('.panel-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
};
window.updateSet = (k, v) => { document.getElementById('v-'+k).innerText = v; state.settings[k] = parseInt(v); };
function showToast(msg) { const t=document.getElementById('toast'); t.innerText=msg; t.style.display='block'; setTimeout(()=>t.style.display='none', 2000); }

// PRESETS
const presets = { zeiss:{exp:-5,con:15,sat:10,shp:30}, portrait:{exp:10,con:5,sat:-5,shp:10}, cine:{exp:-10,con:20,sat:-20,shp:0}, bw:{exp:0,con:30,sat:-100,shp:20}, vivid:{exp:0,con:10,sat:40,shp:10}, pure:{exp:0,con:0,sat:0,shp:50} };
window.applyPreset = (k) => {
    const p = presets[k];
    Object.keys(p).forEach(key => { state.settings[key] = p[key]; document.getElementById(key).value = p[key]; document.getElementById('v-'+key).innerText = p[key]; });
    runWorker('preview');
    showToast("Applied: " + k);
};

// WORKER & RENDER
window.runWorker = (mode) => {
    document.getElementById('sysLoader').style.display = 'flex';
    const imgData = ctx.getImageData(0,0,canvas.width, canvas.height);
    
    // CACHE BUSTER FOR WORKER
    const worker = new Worker('worker.js?v=' + Date.now());
    
    worker.onmessage = e => {
        if(e.data.type === 'done') {
            const res = new ImageData(new Uint8ClampedArray(e.data.buffer), canvas.width, canvas.height);
            ctx.putImageData(res, 0, 0);
            document.getElementById('sysLoader').style.display = 'none';
            showToast("Complete");
        }
    };
    worker.postMessage({ mode: mode, buffer: imgData.data.buffer, width: canvas.width, height: canvas.height, s: state.settings }, [imgData.data.buffer]);
};

window.renderFinal = () => {
    const scale = parseInt(document.getElementById('scaleSel').value);
    if(canvas.width * scale * canvas.height * scale > 35000000) { alert("⚠️ Limited to safe res"); return; }
    
    const finalCvs = document.createElement('canvas');
    finalCvs.width = canvas.width * scale;
    finalCvs.height = canvas.height * scale;
    const fCtx = finalCvs.getContext('2d');
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    fCtx.drawImage(canvas, 0, 0, finalCvs.width, finalCvs.height);
    
    const link = document.createElement('a');
    link.download = 'APEX_Edit.jpg';
    link.href = finalCvs.toDataURL('image/jpeg', 0.95);
    link.click();
};
