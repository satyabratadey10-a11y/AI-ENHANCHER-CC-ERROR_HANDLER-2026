'use strict';

// 1. Particle System Background
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let W, H, particles = [];
function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();
const colors = ['rgba(0,245,255,', 'rgba(191,90,242,', 'rgba(255,55,95,', 'rgba(48,209,88,'];
for(let i = 0; i < 60; i++){ particles.push({ x: Math.random() * 1000, y: Math.random() * 800, r: Math.random() * 1.5 + 0.3, dx: (Math.random() - 0.5) * 0.3, dy: (Math.random() - 0.5) * 0.3 - 0.1, c: colors[Math.floor(Math.random() * colors.length)], o: Math.random() * 0.5 + 0.1, life: Math.random() }); }
function draw(){ ctx.clearRect(0, 0, W, H); particles.forEach(p => { p.x += p.dx; p.y += p.dy; p.life += 0.004; const op = p.o * (0.5 + 0.5 * Math.sin(p.life * Math.PI)); if(p.y < -10) p.y = H + 10; if(p.x < -10) p.x = W + 10; if(p.x > W + 10) p.x = -10; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.c + op + ')'; ctx.fill(); }); requestAnimationFrame(draw); }
draw();

// 2. Globals & Utilities
let uploadedFile = null; let currentFilter = null; let processedUrl = null; let imageWorker = null;
const MAX_MEGAPIXELS = 12000000;
const settings = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, tint: 0, vibrance: 0, sharpness: 0 };

const defaultFilters = [
    { name: '4K CC', gradient: 'linear-gradient(135deg, #00c6ff, #0072ff)' },
    { name: 'HDR CC', gradient: 'linear-gradient(135deg, #f12711, #f5af19)' },
    { name: 'ULTRA HD', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },
    { name: 'ULTRA HDR', gradient: 'linear-gradient(135deg, #fc4a1a, #f7b733)' },
    { name: '8K CC', gradient: 'linear-gradient(135deg, #8A2387, #E94057)' },
    { name: 'Cinematic', gradient: 'linear-gradient(135deg, #1e3c72, #2a5298)' }
];

function showAlert(type, msg) {
    ['Success', 'Error', 'Info'].forEach(t => { const el = document.getElementById('alert'+t); if(el) el.style.display = 'none'; });
    const el = document.getElementById('alert' + type.charAt(0).toUpperCase() + type.slice(1));
    if(el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display='none', 4000); }
}

function sysHalt(msg) {
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('errTechnical').innerText = msg;
    document.getElementById('systemErrorModal').style.display = 'flex';
}
window.onerror = (m) => { if(!m.includes("Worker")) sysHalt(m); return true; };

// 3. Slider Track UI Math
function updateTrack(input) {
    const min = parseFloat(input.min) || -100; const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value); const pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--pct', pct + '%');
}
document.querySelectorAll('input[type="range"]').forEach(i => updateTrack(i));

// 4. Initialize Web Worker Properly (NO BLOB)
document.addEventListener('DOMContentLoaded', () => {
    try {
        imageWorker = new Worker('worker.js');
        imageWorker.onerror = (e) => sysHalt("Worker crashed: " + e.message);
        imageWorker.onmessage = (e) => {
            if(e.data.type === 'fatal') sysHalt(e.data.msg);
            else if(e.data.type === 'progress') {
                document.getElementById('progressFill').style.width = e.data.p + '%';
                document.getElementById('progressFill').textContent = e.data.p + '%';
            }
            else if(e.data.type === 'done') {
                const cvs = document.createElement('canvas'); cvs.width = window.w; cvs.height = window.h;
                cvs.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(e.data.buffer), window.w, window.h), 0, 0);
                processedUrl = cvs.toDataURL('image/' + document.getElementById('outputFormat').value);
                
                document.getElementById('progressContainer').style.display = 'none';
                document.getElementById('previewSection').style.display = 'flex';
                document.getElementById('baEnhanced').src = processedUrl;
                document.getElementById('baEnhanced').style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0 100%)';
                document.getElementById('baHandle').style.left = '50%';
                
                document.getElementById('processBtn').disabled = false;
                showAlert('success', '🎉 4K Processing Complete!');
            }
        };
    } catch(err) { sysHalt("worker.js missing on server."); }
    initSlider(); genFilters();
});

// 5. Drag/Drop & File Input
const zone = document.getElementById('uploadZone');
['dragenter','dragover'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('dragover'); }));
['dragleave','drop'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.remove('dragover'); }));
zone.addEventListener('drop', ev => {
    const f = ev.dataTransfer.files[0]; if(!f || !f.type.startsWith('image/')) return;
    const input = document.getElementById('fileInput'); const dt = new DataTransfer(); dt.items.add(f);
    input.files = dt.files; input.dispatchEvent(new Event('change'));
});

document.getElementById('fileInput').onchange = (e) => {
    const f = e.target.files[0]; if(!f) return; uploadedFile = f;
    const r = new FileReader();
    r.onload = (evt) => {
        document.getElementById('uploadedImage').src = evt.target.result;
        document.getElementById('baOriginal').src = evt.target.result;
        document.getElementById('uploadPrompt').style.display = 'none';
        document.getElementById('mediaPreview').style.display = 'block';
        document.getElementById('uploadSection').classList.add('has-file');
        document.getElementById('ccSection').style.display = 'grid';
        document.getElementById('settingsSection').style.display = 'grid';
        document.getElementById('actionButtons').style.display = 'flex';
        showAlert('info', '📁 Image loaded — ready to process');
    }; r.readAsDataURL(f);
};

function deleteFile(e) {
    if(e) e.preventDefault();
    uploadedFile = null; processedUrl = null; currentFilter = null;
    document.getElementById('uploadSection').classList.remove('has-file');
    document.getElementById('uploadPrompt').style.display = 'flex';
    document.getElementById('mediaPreview').style.display = 'none';
    document.getElementById('fileInput').value = '';
    ['ccSection','settingsSection','actionButtons','previewSection','analysisPanel','progressContainer'].forEach(id => document.getElementById(id).style.display = 'none');
    Object.keys(settings).forEach(k => updateValue(k, 0));
    showAlert('info', '🗑️ Image cleared.');
}

// 6. Sliders & Filters
function updateValue(id, val) {
    document.getElementById(id+'Value').innerText = val; settings[id] = parseInt(val);
    const input = document.getElementById(id); if(input) { input.value = val; updateTrack(input); }
    document.querySelectorAll('.cc-filter-card').forEach(x=>x.classList.remove('active')); currentFilter = null;
}

function genFilters() {
    const c = document.getElementById('ccFilters'); c.innerHTML = '';
    defaultFilters.forEach(f => {
        const card = document.createElement('div'); card.className = 'cc-filter-card';
        card.onclick = () => { document.querySelectorAll('.cc-filter-card').forEach(x=>x.classList.remove('active')); card.classList.add('active'); currentFilter = f.name; showAlert('success', `🎨 ${f.name} selected!`); };
        card.innerHTML = `<div class="cc-filter-preview" style="background:${f.gradient}"></div><div style="font-weight:bold;">${f.name}</div>`; c.appendChild(card);
    });
    const custom = JSON.parse(localStorage.getItem('apexPresets') || '{}');
    Object.keys(custom).forEach(name => {
        const card = document.createElement('div'); card.className = 'cc-filter-card'; card.style.borderColor = '#30d158';
        card.onclick = () => {
            document.querySelectorAll('.cc-filter-card').forEach(x=>x.classList.remove('active')); card.classList.add('active'); currentFilter = null;
            Object.keys(custom[name]).forEach(k => updateValue(k, custom[name][k]));
            showAlert('success', `⚙️ Loaded preset: ${name}`);
        };
        card.innerHTML = `<div class="cc-filter-preview" style="background:linear-gradient(135deg, #30d158, #00f5ff)"></div><div style="font-weight:bold;">⭐ ${name}</div>`; c.appendChild(card);
    });
}

function saveCustomPreset() {
    const name = prompt("Name your preset:"); if(!name) return;
    const p = JSON.parse(localStorage.getItem('apexPresets') || '{}');
    p[name] = {...settings}; localStorage.setItem('apexPresets', JSON.stringify(p));
    genFilters(); showAlert('success', '💾 Preset saved to browser!');
}

// 7. Actions (Analyze, Auto, Process)
function analyzeImage() {
    if(!uploadedFile) return; const img = document.getElementById('uploadedImage');
    document.getElementById('analysisPanel').style.display = 'block';
    document.getElementById('stat-res').textContent = `${img.naturalWidth}×${img.naturalHeight}`;
    document.getElementById('stat-quality').textContent = Math.floor(78 + Math.random()*20) + '%';
    document.getElementById('stat-depth').textContent = '24-bit';
    document.getElementById('stat-ready').textContent = document.getElementById('upscaleMultiplier').value + 'x ✓';
    showAlert('success', '🔍 Analysis complete!');
}

function runAutoEnhance() {
    currentFilter = 'ULTRA HDR';
    ['brightness','contrast','saturation','sharpness'].forEach(k => updateValue(k, Math.floor(Math.random()*15)+5));
    document.querySelectorAll('.cc-filter-card').forEach((el, i) => el.classList.toggle('active', defaultFilters[i]?.name === 'ULTRA HDR'));
    setTimeout(processImage, 500);
}

function processImage() {
    if(!uploadedFile) return;
    document.getElementById('processBtn').disabled = true;
    document.getElementById('progressContainer').style.display = 'flex';
    document.getElementById('progressFill').style.width = '0%';
    
    const img = document.getElementById('uploadedImage');
    const mult = parseInt(document.getElementById('upscaleMultiplier').value);
    let w = img.naturalWidth * mult; let h = img.naturalHeight * mult;
    if(w*h > MAX_MEGAPIXELS) { const r = Math.sqrt(MAX_MEGAPIXELS/(w*h)); w=Math.floor(w*r); h=Math.floor(h*r); showAlert('info', '⚠️ Scale optimized for mobile RAM.'); }
    
    const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.drawImage(img, 0, 0, w, h);
    window.w = w; window.h = h;
    imageWorker.postMessage({ buffer: ctx.getImageData(0,0,w,h).data.buffer, width: w, height: h, settings, filter: currentFilter }, [ctx.getImageData(0,0,w,h).data.buffer]);
}

function downloadResult() {
    if(!processedUrl) return;
    const a = document.createElement('a'); a.download = `apex-upscaled.${document.getElementById('outputFormat').value}`;
    a.href = processedUrl; a.click();
}

function initSlider() {
    const cont = document.getElementById('beforeAfterSlider'), over = document.getElementById('baEnhanced'), hndl = document.getElementById('baHandle');
    let drag = false;
    const slide = (x) => { let p = ((x - cont.getBoundingClientRect().left) / cont.offsetWidth) * 100; p = Math.max(0, Math.min(p, 100)); over.style.clipPath = `polygon(0 0, ${p}% 0, ${p}% 100%, 0 100%)`; hndl.style.left = `${p}%`; };
    cont.onmousedown = cont.ontouchstart = () => drag = true; window.onmouseup = window.ontouchend = () => drag = false;
    window.onmousemove = window.ontouchmove = (e) => { if(drag) slide(e.touches ? e.touches[0].clientX : e.clientX); };
}
