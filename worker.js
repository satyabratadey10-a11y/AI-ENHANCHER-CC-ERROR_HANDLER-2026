self.onmessage = function(e) { 
    try { 
        const { buffer, width, height, settings, filter } = e.data;
        const data = new Uint8ClampedArray(buffer); 
        const totalPixels = width * height; 
        
        const bFactor = 1 + (settings.brightness / 100); 
        const cFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast)); 
        const eFactor = Math.pow(2, settings.exposure / 100); 
        const sFactor = 1 + (settings.saturation / 100); 
        const temp = settings.temperature; 
        const tint = settings.tint; 
        const vib = settings.vibrance / 100; 

        for (let i = 0; i < data.length; i += 4) { 
            let r = data[i], g = data[i+1], b = data[i+2]; 

            r *= bFactor * eFactor; g *= bFactor * eFactor; b *= bFactor * eFactor; 
            r = cFactor * (r - 128) + 128; g = cFactor * (g - 128) + 128; b = cFactor * (b - 128) + 128; 

            if (temp > 0) { r += temp*0.5; b -= temp*0.3; } else { b -= temp*0.5; r += temp*0.3; } 
            if (tint > 0) { r += tint*0.3; b += tint*0.3; } else { g -= tint*0.5; } 

            const gray = 0.299*r + 0.587*g + 0.114*b; 
            r = gray + (r - gray)*sFactor; g = gray + (g - gray)*sFactor; b = gray + (b - gray)*sFactor; 

            if (vib !== 0) { 
                const max = Math.max(r, g, b); const avg = (r+g+b)/3; 
                const amt = (Math.abs(max-avg)*2/255) * vib; 
                if (r !== max) r += (max-r)*amt; if (g !== max) g += (max-g)*amt; if (b !== max) b += (max-b)*amt; 
            } 

            if (filter === '4K CC') { r *= 1.05; g *= 1.02; b *= 1.08; } 
            else if (filter === 'HDR CC') { r = gray + (r - gray)*1.2; g = gray + (g - gray)*1.2; b = gray + (b - gray)*1.2; }
            else if (filter === 'ULTRA HD') { r = cFactor * 1.1 * (r - 128) + 128; b = cFactor * 1.05 * (b - 128) + 128; if (r > g && r > b) { r *= 1.1; b *= 0.9; } }
            else if (filter === 'ULTRA HDR') { r = (r - 128) * 1.3 + 128; g = (g - 128) * 1.3 + 128; b = (b - 128) * 1.3 + 128; r = gray + (r - gray)*1.4; g = gray + (g - gray)*1.4; b = gray + (b - gray)*1.4; }
            else if (filter === '8K CC') { if (gray < 80) { r *= 0.8; g *= 0.8; b *= 0.8; } r *= 1.02; g *= 1.02; b *= 1.05; }
            else if (filter === 'Cinematic') { if (gray < 128) { b += 20; g += 10; } else { r += 15; g += 10; b -= 10; } r *= 0.95; g *= 0.95; b *= 1.05; } 
            else if (filter === 'Black & White') { r = g = b = gray; } 

            data[i] = Math.max(0, Math.min(255, r)); data[i+1] = Math.max(0, Math.min(255, g)); data[i+2] = Math.max(0, Math.min(255, b)); 

            if (i % 800000 === 0) self.postMessage({ type: 'progress', percent: Math.floor((i/(totalPixels*4)) * 90) }); 
        } 

        let finalSharpness = settings.sharpness;
        if (filter === '4K CC' && finalSharpness === 0) finalSharpness = 20;
        if (filter === '8K CC' && finalSharpness === 0) finalSharpness = 40;
        if (filter === 'ULTRA HDR' && finalSharpness === 0) finalSharpness = 30;

        if (finalSharpness !== 0) { 
            const amount = finalSharpness / 100; 
            const tempData = new Uint8ClampedArray(data); 
            const w4 = width * 4; 
            for (let y = 1; y < height - 1; y++) { 
                for (let x = 1; x < width - 1; x++) { 
                    const idx = y * w4 + x * 4; 
                    for (let c = 0; c < 3; c++) { 
                        const center = tempData[idx + c]; 
                        const edge = (4 * center - tempData[idx - w4 + c] - tempData[idx + w4 + c] - tempData[idx - 4 + c] - tempData[idx + 4 + c]) * amount; 
                        data[idx + c] = Math.max(0, Math.min(255, center + edge)); 
                    } 
                } 
                if (y % Math.floor(height/10) === 0) self.postMessage({ type: 'progress', percent: 80 + Math.floor((y/height) * 20) }); 
            } 
        } 
        self.postMessage({ type: 'done', buffer: data.buffer }, [data.buffer]); 
    } catch(err) { self.postMessage({ type: 'fatal', msg: err.message }); } 
};
