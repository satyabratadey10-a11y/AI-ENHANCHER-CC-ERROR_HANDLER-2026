self.onmessage = function(e) { 
    try { 
        const buffer = e.data.buffer; 
        const width = e.data.width; 
        const height = e.data.height; 
        const settings = e.data.settings; 
        const filter = e.data.filter; 
        
        const data = new Uint8ClampedArray(buffer); 
        const totalPixels = width * height; 
        
        const bFactor = 1 + (settings.brightness / 100); 
        const cFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast)); 
        const eFactor = Math.pow(2, settings.exposure / 100); 
        const sFactor = 1 + (settings.saturation / 100); 
        const temp = settings.temperature; 
        const tint = settings.tint; 
        const vib = settings.vibrance / 100; 
        
        const updateThreshold = Math.floor(totalPixels / 20) || 1; 
        let pixelCount = 0; 

        for (let i = 0; i < data.length; i += 4) { 
            let r = data[i]; let g = data[i+1]; let b = data[i+2]; 

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

            if (filter === 'Cinematic') { if (gray < 128) { b += 20; g += 10; } else { r += 15; g += 10; b -= 10; } r *= 0.95; g *= 0.95; b *= 1.05; } 
            else if (filter === 'Vintage') { r += 30; g += 15; b -= 10; const vg = 0.299*r + 0.587*g + 0.114*b; r = vg + (r-vg)*0.7; g = vg + (g-vg)*0.7; b = vg + (b-vg)*0.7; } 
            else if (filter === 'Cool Blue') { r *= 0.85; g *= 0.95; b *= 1.15; } 
            else if (filter === 'Warm Sunset') { r *= 1.15; g *= 1.05; b *= 0.85; } 
            else if (filter === 'Black & White') { r = g = b = gray; } 
            else if (filter === 'Vibrant') { r = gray + (r-gray)*1.5; g = gray + (g-gray)*1.5; b = gray + (b-gray)*1.5; } 
            else if (filter === 'Moody') { r = (r * 0.85) + 15; g *= 0.75; b = (b * 0.95) + 20; } 
            else if (filter === 'Pastel') { r = gray + (r-gray)*0.6 + 30; g = gray + (g-gray)*0.6 + 30; b = gray + (b-gray)*0.6 + 30; } 

            data[i] = Math.max(0, Math.min(255, r)); 
            data[i+1] = Math.max(0, Math.min(255, g)); 
            data[i+2] = Math.max(0, Math.min(255, b)); 

            pixelCount++; 
            if (pixelCount % 200000 === 0) { 
                self.postMessage({ type: 'progress', percent: Math.floor((pixelCount/totalPixels) * 80) }); 
            } 
        } 

        if (settings.sharpness !== 0) { 
            const amount = settings.sharpness / 100; 
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
                if (y % Math.floor(height/10) === 0) { self.postMessage({ type: 'progress', percent: 80 + Math.floor((y/height) * 20) }); } 
            } 
        } 
        self.postMessage({ type: 'done', buffer: data.buffer }, [data.buffer]); 
    } catch(err) { self.postMessage({ type: 'fatal', name: err.name, msg: err.message }); } 
};
