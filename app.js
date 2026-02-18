// INJECT UI
document.body.insertAdjacentHTML('beforeend', `
<div id="toast">Notification</div>
<header><div class="logo">APEX AI</div><div class="cloud-status"><div class="dot" id="cloudDot"></div> <span id="cloudText">OFFLINE</span></div></header>
<div id="workspace">
    <div id="emptyState"><h2 style="font-family:'Orbitron'">STUDIO</h2><label for="fileInput" class="upload-btn">OPEN IMAGE</label><input type="file" id="fileInput" accept="image/*" style="display:none"></div>
    <canvas id="mainCanvas"></canvas>
</div>
<div id="sysLoader"><div class="spinner"></div><p style="margin-top:10px; color:#666; font-family:'Orbitron'">PROCESSING</p></div>
<div id="controls">
    <div class="tabs"><div class="tab active" onclick="setTab('ai', this)">✨ AI</div><div class="tab" onclick="setTab('adjust', this)">🎚 EDIT</div><div class="tab" onclick="setTab('cloud', this)">☁️ CLOUD</div></div>
    <div id="tab-ai" class="panel active"><div class="grid"><div class="card" onclick="runWorker('removeBg')"><i>✂️</i><span>Remove BG</span></div><div class="card" onclick="runWorker('magic')"><i>🪄</i><span>Magic Eraser</span></div><div class="card" onclick="runWorker('face')"><i>😀</i><span>Face Fix</span></div><div class="card" onclick="runWorker('color')"><i>🎨</i><span>Colorize</span></div></div></div>
    <div id="tab-adjust" class="panel"><div class="slider-group"><div class="slider-label"><span>EXPOSURE</span><span id="v-exp">0</span></div><input type="range" id="exp" min="-100" max="100" value="0" oninput="updateVal('exp',this.value)"></div><div class="slider-group"><div class="slider-label"><span>CONTRAST</span><span id="v-con">0</span></div><input type="range" id="con" min="-100" max="100" value="0" oninput="updateVal('con',this.value)"></div><div class="slider-group"><div class="slider-label"><span>ZEISS POP</span><span id="v-pop">0</span></div><input type="range" id="pop" min="0" max="100" value="0" oninput="updateVal('pop',this.value)"></div></div>
    <div id="tab-cloud" class="panel"><h4 style="margin-top:0; color:var(--neon)">VERCEL BLOB STORAGE</h4><p style="font-size:0.8em; color:#666; margin-bottom:15px;">Save your edit securely.</p><button class="upload-btn" style="width:100%; background:var(--zeiss); color:#fff; border:none;" onclick="saveToCloud()">UPLOAD TO CLOUD</button><button class="upload-btn" style="width:100%; margin-top:10px;" onclick="renderDownload()">DOWNLOAD LOCAL</button></div>
</div>
`);

// APP LOGIC
const state = { img: new Image(), settings: {exp:0, con:0, pop:0} };
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// Check Cloud Connection
fetch('/api/upload', {method:'OPTIONS'}).then(() => {
    document.getElementById('cloudDot').classList.add('online');
    document.getElementById('cloudText').innerText = "ONLINE";
}).catch(() => document.getElementById('cloudText').innerText = "OFFLINE");

document.getElementById('fileInput').addEventListener('change', e => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = evt => {
        state.img.src = evt.target.result;
        state.img.onload = () => {
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('controls').style.display = 'flex';
            canvas.width = state.img.naturalWidth;
            canvas.height = state.img.naturalHeight;
            ctx.drawImage(state.img, 0, 0);
        }
    };
    r.readAsDataURL(f);
});

// CLOUD UPLOAD
async function saveToCloud() {
    showLoader(true);
    canvas.toBlob(async (blob) => {
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'x-filename': 'apex_' + Date.now() + '.png' },
                body: blob
            });
            const data = await res.json();
            showLoader(false);
            if(data.url) alert("✅ Saved! URL: " + data.url);
            else alert("❌ Error: " + JSON.stringify(data));
        } catch(err) {
            showLoader(false);
            alert("❌ Network Error");
        }
    }, 'image/png');
}

// WORKER
function runWorker(mode) {
    showLoader(true);
    const d = ctx.getImageData(0,0,canvas.width, canvas.height);
    const w = new Worker('worker.js?v=' + Date.now());
    w.onmessage = e => {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(e.data.buffer), canvas.width, canvas.height), 0, 0);
        showLoader(false);
    };
    w.postMessage({mode:mode, buffer:d.data.buffer, s:state.settings}, [d.data.buffer]);
}

// UTILS
window.setTab = (id, el) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-'+id).classList.add('active');
    el.classList.add('active');
};
window.updateVal = (k, v) => { state.settings[k] = parseInt(v); document.getElementById('v-'+k).innerText = v; };
window.showLoader = (b) => { document.getElementById('sysLoader').style.display = b ? 'flex' : 'none'; };
window.renderDownload = () => {
    const l = document.createElement('a'); l.download = 'APEX.png'; l.href = canvas.toDataURL(); l.click();
};
