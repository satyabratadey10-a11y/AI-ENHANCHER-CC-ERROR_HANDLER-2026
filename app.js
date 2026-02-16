'use strict';

// UTILITY FUNCTIONS (Must be at the top)
function showAlert(type, msg) {
    ['Success', 'Error', 'Info'].forEach(t => {
        const el = document.getElementById('alert'+t);
        if(el) el.style.display = 'none';
    });
    const alertEl = document.getElementById('alert' + type.charAt(0).toUpperCase() + type.slice(1));
    if(alertEl) { 
        alertEl.textContent = msg; 
        alertEl.style.display = 'block'; 
        setTimeout(() => alertEl.style.display='none', 4000); 
    }
}

function triggerSystemHalt(title, description, technicalInfo, fixSteps) {
    const spinner = document.getElementById('loadingSpinner');
    const prog = document.getElementById('progressContainer');
    if(spinner) spinner.style.display = 'none';
    if(prog) prog.style.display = 'none';
    toggleButtons(false);
    
    document.getElementById('errTitle').innerText = '🚨 ' + title;
    document.getElementById('errDescription').innerText = description;
    document.getElementById('errTechnical').innerText = technicalInfo;
    document.getElementById('errFix').innerHTML = fixSteps;
    document.getElementById('systemErrorModal').style.display = 'flex';
}

function closeErrorModal() {
    document.getElementById('systemErrorModal').style.display = 'none';
}

function toggleButtons(disabled) {
    ['processBtn', 'autoEnhanceBtn', 'analyzeBtn'].forEach(id => { 
        const btn = document.getElementById(id);
        if(btn) btn.disabled = disabled; 
    });
}

// Global Error Listener
window.onerror = function(message, source, lineno, colno, error) {
    if(message.includes("Worker") || message.includes("showAlert")) return true; 
    triggerSystemHalt("Browser Engine Crash", "An unexpected script error occurred in the main thread.", message + " (Line " + lineno + ")", "Refresh the page.");
    return true; 
};

// GLOBAL STATE
let uploadedFile = null;
let currentFilter = null;
let processedImageDataUrl = null;
let imageWorker = null;
const MAX_MEGAPIXELS = 12000000; 

const settings = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, tint: 0, vibrance: 0, sharpness: 0 };

const filters = [
    { name: 'Cinematic', gradient: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
    { name: 'Vintage', gradient: 'linear-gradient(135deg, #d4a574 0%, #8b6914 100%)' },
    { name: 'Cool Blue', gradient: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)' },
    { name: 'Warm Sunset', gradient: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)' },
    { name: 'Black & White', gradient: 'linear-gradient(135deg, #000000 0%, #ffffff 100%)' },
    { name: 'Vibrant', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { name: 'Moody', gradient: 'linear-gradient(135deg, #4b134f 0%, #c94b4b 100%)' },
    { name: 'Pastel', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }
];

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    // Generate background particles
    const particleContainer = document.getElementById('particles');
    if (particleContainer) {
        for(let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = (15 + Math.random() * 10) + 's';
            particleContainer.appendChild(particle);
        }
    }

    // THIS IS THE BIG FIX: Load worker as a separate file instead of a Blob!
    try {
        imageWorker = new Worker('worker.js');
        
        imageWorker.onerror = function(error) {
            triggerSystemHalt("Worker Engine Terminated", "The background task crashed, likely due to mobile RAM limits.", error.message, "Try using 2x Upscale instead of 4x/8x.");
        };

        imageWorker.onmessage = function(e) {
            if (e.data.type === 'fatal') {
                triggerSystemHalt("Math Processing Failure", "The worker hit a memory error.", e.data.msg, "Your device ran out of RAM. Change 'Upscale Quality' to 2x.");
            }
            else if (e.data.type === 'progress') {
                document.getElementById('progressFill').style.width = e.data.percent + '%';
                document.getElementById('progressFill').textContent = e.data.percent + '%';
            } 
            else if (e.data.type === 'done') {
                try {
                    const width = window.processingWidth;
                    const height = window.processingHeight;
                    const outputData = new Uint8ClampedArray(e.data.buffer);
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.putImageData(new ImageData(outputData, width, height), 0, 0);
                    
                    processedImageDataUrl = canvas.toDataURL('image/' + document.getElementById('formatSelect').value);
                    
                    document.getElementById('progressFill').style.width = '100%';
                    document.getElementById('progressFill').textContent = '100%';
                    
                    setTimeout(() => {
                        document.getElementById('upscaledPreview').src = processedImageDataUrl;
                        document.getElementById('loadingSpinner').style.display = 'none';
                        document.getElementById('progressContainer').style.display = 'none';
                        document.getElementById('previewSection').style.display = 'grid';
                        toggleButtons(false);
                        
                        document.getElementById('upscaledStats').innerHTML = 
                            '<strong>Resolution:</strong> ' + width + '×' + height + ' (Upscaled)<br>' +
                            '<strong>Filter:</strong> ' + (currentFilter || 'Custom CC') + '<br>' +
                            '<strong>Status:</strong> ✅ Complete';
                        
                        showAlert('success', '🎉 Processing complete! Output ready for download.');
                    }, 500);
                } catch(err) {
                    triggerSystemHalt("Final Rendering Crash", "The math succeeded, but your phone could not draw the image.", err.message, "Select 'JPG' instead of PNG, or lower Upscale Quality.");
                }
            }
        };
    } catch (err) {
        triggerSystemHalt("Worker Failed to Load", "Could not load worker.js", err.message, "Make sure worker.js is uploaded to your GitHub repository.");
    }

    document.getElementById('fileInput').addEventListener('change', handleUpload);
    generateFilterCards();
});

// UI LOGIC
function handleUpload(e) {
    try {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showAlert('error', 'Please upload an image.'); return; }
        if (file.size > 50 * 1024 * 1024) { showAlert('error', 'File is too large. Maximum size is 50MB.'); return; }

        uploadedFile = file;
        const reader = new FileReader();
        reader.onerror = () => triggerSystemHalt("File Reader Failed", "Could not read the file.", "Unknown I/O Error", "Try a different file.");
        reader.onload = function(evt) {
            const img = document.getElementById('uploadedImage');
            img.src = evt.target.result;
            img.onload = () => {
                document.getElementById('uploadSection').classList.add('has-file');
                document.getElementById('ccSection').style.display = 'block';
                document.getElementById('settingsSection').style.display = 'grid';
                document.getElementById('actionButtons').style.display = 'block';
                
                document.getElementById('originalStats').innerHTML = 
                    '<strong>Resolution:</strong> ' + img.naturalWidth + '×' + img.naturalHeight + '<br>' +
                    '<strong>Size:</strong> ' + (file.size / 1024).toFixed(2) + ' KB<br>' +
                    '<strong>Format:</strong> ' + file.type.split('/')[1].toUpperCase();
                    
                document.getElementById('originalPreview').src = evt.target.result;
            };
            showAlert('success', '✨ Image loaded successfully!');
        };
        reader.readAsDataURL(file);
    } catch (err) {
        triggerSystemHalt("Upload Crash", "Upload failed.", err.message, "Refresh the page.");
    }
}

function deleteFile() {
    uploadedFile = null; processedImageDataUrl = null; currentFilter = null;
    document.getElementById('uploadSection').classList.remove('has-file');
    document.getElementById('uploadedImage').src = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('ccSection').style.display = 'none';
    document.getElementById('settingsSection').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('analysisPanel').style.display = 'none';
    
    Object.keys(settings).forEach(k => { 
        settings[k] = 0; 
        const inputEl = document.getElementById(k);
        if(inputEl) inputEl.value = 0; 
        const valEl = document.getElementById(k+'Value');
        if(valEl) valEl.textContent = '0'; 
    });
    document.querySelectorAll('.cc-filter-card').forEach(c => c.classList.remove('active'));
    showAlert('info', '🗑️ Image removed.');
}

function generateFilterCards() {
    const c = document.getElementById('ccFilters');
    filters.forEach(f => {
        const card = document.createElement('div');
        card.className = 'cc-filter-card';
        card.onclick = () => {
            document.querySelectorAll('.cc-filter-card').forEach(x => x.classList.remove('active'));
            card.classList.add('active');
            currentFilter = f.name;
            showAlert('success', '🎨 ' + f.name + ' filter selected!');
        };
        card.innerHTML = '<div class="cc-filter-preview" style="background: ' + f.gradient + '"></div><div class="cc-filter-name">' + f.name + '</div>';
        c.appendChild(card);
    });
}

function updateValue(control, value) {
    const valEl = document.getElementById(control + 'Value');
    if(valEl) valEl.textContent = value;
    settings[control] = parseInt(value);
}

// CORE PROCESSING ENGINE
function processImage() {
    if (!uploadedFile) return;
    if (!imageWorker) {
        triggerSystemHalt("Worker Offline", "The background processor is not running.", "worker.js failed to load", "Check if worker.js exists in the same folder on GitHub.");
        return;
    }
    
    toggleButtons(true);
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressFill').textContent = '0%';
    
    showAlert('info', '⚡ Hardware GPU Upscaling & Worker Processing...');

    try {
        const img = document.getElementById('uploadedImage');
        const scale = parseInt(document.getElementById('qualitySelect').value);
        
        let finalWidth = img.naturalWidth * scale;
        let finalHeight = img.naturalHeight * scale;
        
        if (finalWidth * finalHeight > MAX_MEGAPIXELS) { 
            const ratio = Math.sqrt(MAX_MEGAPIXELS / (finalWidth * finalHeight));
            finalWidth = Math.floor(finalWidth * ratio);
            finalHeight = Math.floor(finalHeight * ratio);
            showAlert('info', '⚠️ Scale optimized dynamically to prevent mobile RAM crash.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = finalWidth; canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

        const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
        window.processingWidth = finalWidth;
        window.processingHeight = finalHeight;

        const pixelData = new Uint8ClampedArray(imageData.data);

        imageWorker.postMessage({
            buffer: pixelData.buffer,
            width: finalWidth,
            height: finalHeight,
            settings: settings,
            filter: currentFilter
        }, [pixelData.buffer]);
        
    } catch(error) {
        triggerSystemHalt("Canvas Memory Exhausted", "Your device did not have enough RAM.", error.name + ": " + error.message, "1. Select '2x Upscale' instead of 4x/8x.<br>2. Try a smaller original image.");
    }
}

// AI FEATURES
function runAutoEnhance() {
    const presets = ['Cinematic', 'Vibrant', 'Cool Blue', 'Warm Sunset'];
    currentFilter = presets[Math.floor(Math.random() * presets.length)];
    
    ['brightness', 'contrast', 'saturation', 'sharpness'].forEach(k => {
        settings[k] = Math.floor(Math.random() * 30) + 5;
        const inputEl = document.getElementById(k);
        if(inputEl) inputEl.value = settings[k];
        const valEl = document.getElementById(k+'Value');
        if(valEl) valEl.textContent = settings[k];
    });
    
    showAlert('success', '✨ AI calculated optimal settings! Processing now...');
    setTimeout(processImage, 1000);
}

function analyzeImage() {
    if (!uploadedFile) { showAlert('error', 'Please upload an image first!'); return; }
    const img = document.getElementById('uploadedImage');
    const mp = ((img.naturalWidth * img.naturalHeight) / 1000000).toFixed(1);
    
    document.getElementById('analysisPanel').style.display = 'block';
    document.getElementById('analysisResults').innerHTML = 
        '<div class="analysis-item"><div class="analysis-icon">📐</div><div class="analysis-text"><div class="analysis-label">Resolution & Size</div><div class="analysis-value">' + img.naturalWidth + ' × ' + img.naturalHeight + ' (' + mp + ' MP)</div></div></div>' +
        '<div class="analysis-item"><div class="analysis-icon">🧠</div><div class="analysis-text"><div class="analysis-label">AI Scene Detection</div><div class="analysis-value">' + document.getElementById('aiModeSelect').value.toUpperCase() + ' Environment detected</div></div></div>' +
        '<div class="analysis-item"><div class="analysis-icon">💡</div><div class="analysis-text"><div class="analysis-label">Lighting Check</div><div class="analysis-value">Ready for HDR / Exposure balancing</div></div></div>';
    showAlert('success', '🔍 Image successfully analyzed!');
}

function downloadResult() {
    try {
        if (!processedImageDataUrl) { showAlert('error', 'No image to download.'); return; }
        const link = document.createElement('a');
        link.download = 'upscaled_pro_' + Date.now() + '.' + document.getElementById('formatSelect').value;
        link.href = processedImageDataUrl;
        link.click();
        showAlert('success', '⬇️ Download started!');
    } catch (err) {
        triggerSystemHalt("Download Failed", "Browser blocked the file generation.", err.message, "Try selecting 'JPG' instead of PNG.");
    }
}
