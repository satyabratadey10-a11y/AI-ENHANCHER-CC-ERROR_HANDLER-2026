self.onmessage = function(e) {
    const { mode, buffer, width, height, s } = e.data;
    const data = new Uint8ClampedArray(buffer);
    
    const b = 1 + (s.exp / 100);
    const c = (259 * (s.con + 255)) / (255 * (259 - s.con));
    const sat = 1 + (s.sat / 100);

    for(let i=0; i<data.length; i+=4) {
        let r = data[i], g = data[i+1], bl = data[i+2];

        // 1. REMOVE BG (Luminance Key)
        if(mode === 'removeBg') {
            // Detect very bright or very dark areas (simple matte)
            if((r>245 && g>245 && bl>245) || (r<10 && g<10 && bl<10)) {
                data[i+3] = 0; // Transparent
                continue;
            }
        }

        // 2. MAGIC ERASER (Center Patch)
        if(mode === 'magic') {
            const x = (i/4) % width;
            const y = Math.floor((i/4) / width);
            // If in center box
            if(x > width*0.4 && x < width*0.6 && y > height*0.4 && y < height*0.6) {
                // Blur/Clone from left
                r = (r + 200)/2; g = (g + 200)/2; bl = (bl + 200)/2;
            }
        }

        // 3. COLORIZE (Sepia Sim)
        if(mode === 'color') {
            const avg = (r+g+bl)/3;
            r = avg + 40; g = avg + 20; bl = avg; 
        }

        // 4. FACE FIX (Brighten Midtones)
        if(mode === 'face') {
            if(r > g && g > bl) { r*=1.1; g*=1.05; }
        }

        // Standard Adjustments
        r *= b; g *= b; bl *= b;
        r = c * (r - 128) + 128; 
        g = c * (g - 128) + 128; 
        bl = c * (bl - 128) + 128;

        const gray = 0.299*r + 0.587*g + 0.114*bl;
        r = gray + (r - gray)*sat;
        g = gray + (g - gray)*sat;
        bl = gray + (bl - gray)*sat;

        data[i] = Math.max(0, Math.min(255, r));
        data[i+1] = Math.max(0, Math.min(255, g));
        data[i+2] = Math.max(0, Math.min(255, bl));
    }

    self.postMessage({ type: 'done', buffer: data.buffer }, [data.buffer]);
};
