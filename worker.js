self.onmessage = function(e) {
    const { mode, buffer, s } = e.data;
    const data = new Uint8ClampedArray(buffer);
    const b = 1 + (s.exp/100);
    const c = (259*(s.con+255))/(255*(259-s.con));
    const pop = 1 + (s.pop/200);

    for(let i=0; i<data.length; i+=4) {
        let r = data[i], g = data[i+1], bl = data[i+2];

        // AI MODES
        if(mode === 'removeBg') { if(r>240 && g>240 && bl>240) data[i+3] = 0; }
        if(mode === 'color') { const avg = (r+g+bl)/3; r=avg+40; g=avg+20; bl=avg; }
        if(mode === 'magic') { /* Simple cloning logic placeholder */ }

        // ADJUSTMENTS
        r *= b; g *= b; bl *= b;
        r = c*(r-128)*pop + 128;
        g = c*(g-128)*pop + 128;
        bl = c*(bl-128)*pop + 128;

        data[i] = Math.max(0,Math.min(255,r)); 
        data[i+1] = Math.max(0,Math.min(255,g)); 
        data[i+2] = Math.max(0,Math.min(255,bl));
    }
    self.postMessage({buffer:data.buffer}, [data.buffer]);
}
