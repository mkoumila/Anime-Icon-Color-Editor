// GIF Encoder Web Worker

function ByteArray() {
    this.page = -1;
    this.pages = [];
    this.newPage();
}

ByteArray.pageSize = 4096;

ByteArray.prototype.newPage = function() {
    this.pages[++this.page] = new Uint8Array(ByteArray.pageSize);
    this.cursor = 0;
};

ByteArray.prototype.getData = function() {
    const output = new Uint8Array(this.pages.reduce((acc, page) => acc + page.length, 0));
    let offset = 0;
    for (const page of this.pages) {
        output.set(page, offset);
        offset += page.length;
    }
    return output;
};

ByteArray.prototype.writeByte = function(val) {
    if (this.cursor >= ByteArray.pageSize) this.newPage();
    this.pages[this.page][this.cursor++] = val;
};

ByteArray.prototype.writeUTFBytes = function(string) {
    for (let i = 0; i < string.length; i++) {
        this.writeByte(string.charCodeAt(i));
    }
};

ByteArray.prototype.writeBytes = function(array, offset, length) {
    for (let i = 0; i < length; i++) {
        this.writeByte(array[offset + i]);
    }
};

function GIFEncoder() {
    this.width = null;
    this.height = null;
    this.transparent = null;
    this.transIndex = 0;
    this.repeat = -1;
    this.delay = 0;
    this.image = null;
    this.pixels = null;
    this.indexedPixels = null;
    this.colorDepth = null;
    this.colorTab = null;
    this.neuQuant = null;
    this.usedEntry = new Array();
    this.palSize = 7;
    this.dispose = -1;
    this.firstFrame = true;
    this.sample = 10;
    this.out = new ByteArray();
    this.transparentIndex = 0;
}

GIFEncoder.prototype.setDelay = function(milliseconds) {
    this.delay = Math.round(milliseconds / 10);
};

GIFEncoder.prototype.setFrameRate = function(fps) {
    this.delay = Math.round(100 / fps);
};

GIFEncoder.prototype.setDispose = function(disposalCode) {
    if (disposalCode >= 0) this.dispose = disposalCode;
};

GIFEncoder.prototype.setRepeat = function(repeat) {
    this.repeat = repeat;
};

GIFEncoder.prototype.setTransparent = function(color) {
    this.transparent = color;
};

GIFEncoder.prototype.addFrame = function(imageData) {
    this.image = imageData;
    this.getImagePixels();
    this.analyzePixels();
    if (this.firstFrame) {
        this.writeLSD();
        this.writePalette();
        if (this.repeat >= 0) {
            this.writeNetscapeExt();
        }
    }
    this.writeGraphicCtrlExt();
    this.writeImageDesc();
    if (!this.firstFrame) this.writePalette();
    this.writePixels();
    this.firstFrame = false;
};

GIFEncoder.prototype.finish = function() {
    this.out.writeByte(0x3b);
};

GIFEncoder.prototype.setQuality = function(quality) {
    if (quality < 1) quality = 1;
    this.sample = quality;
};

GIFEncoder.prototype.setSize = function(w, h) {
    this.width = w;
    this.height = h;
};

GIFEncoder.prototype.start = function() {
    this.out = new ByteArray();
    this.writeString('GIF89a');
};

GIFEncoder.prototype.writeString = function(s) {
    for (let i = 0; i < s.length; i++) {
        this.out.writeByte(s.charCodeAt(i));
    }
};

GIFEncoder.prototype.getImagePixels = function() {
    const w = this.width;
    const h = this.height;
    this.pixels = new Uint8Array(w * h * 3);
    
    const data = this.image.data;
    let count = 0;
    
    for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
            const b = (i * w * 4) + j * 4;
            this.pixels[count++] = data[b];
            this.pixels[count++] = data[b + 1];
            this.pixels[count++] = data[b + 2];
        }
    }
};

GIFEncoder.prototype.analyzePixels = function() {
    const len = this.pixels.length;
    const nPix = len / 3;
    this.indexedPixels = new Uint8Array(nPix);
    
    const nq = new NeuQuant(this.pixels, this.sample);
    this.colorTab = nq.process();
    
    // Map image pixels to new palette
    let k = 0;
    for (let j = 0; j < nPix; j++) {
        const index = nq.map(this.pixels[k++] & 0xff,
                           this.pixels[k++] & 0xff,
                           this.pixels[k++] & 0xff);
        this.usedEntry[index] = true;
        this.indexedPixels[j] = index;
    }
    
    this.pixels = null;
    this.colorDepth = 8;
    this.palSize = 7;
};

GIFEncoder.prototype.writeLSD = function() {
    // Logical Screen Descriptor
    this.writeShort(this.width);
    this.writeShort(this.height);
    this.out.writeByte(0x80 | 0x70); // GCT following for 256 colors
    this.out.writeByte(0);
    this.out.writeByte(0);
};

GIFEncoder.prototype.writeShort = function(pValue) {
    this.out.writeByte(pValue & 0xFF);
    this.out.writeByte((pValue >> 8) & 0xFF);
};

GIFEncoder.prototype.writePalette = function() {
    this.out.writeBytes(this.colorTab, 0, this.colorTab.length);
    const n = (3 * 256) - this.colorTab.length;
    for (let i = 0; i < n; i++) {
        this.out.writeByte(0);
    }
};

GIFEncoder.prototype.writeNetscapeExt = function() {
    this.out.writeByte(0x21); // Extension Introducer
    this.out.writeByte(0xff); // App Extension Label
    this.out.writeByte(11); // Block Size
    this.writeString('NETSCAPE2.0');
    this.out.writeByte(3); // Block Size
    this.out.writeByte(1); // Loop Indicator
    this.writeShort(this.repeat); // Loop Count
    this.out.writeByte(0); // Block Terminator
};

GIFEncoder.prototype.writeGraphicCtrlExt = function() {
    this.out.writeByte(0x21); // Extension Introducer
    this.out.writeByte(0xf9); // Graphic Control Label
    this.out.writeByte(4); // Block Size
    let transp, disp;
    if (this.transparent === null) {
        transp = 0;
        disp = 0;
    } else {
        transp = 1;
        disp = 2;
    }
    disp <<= 2;
    this.out.writeByte(0 | disp | 0 | transp);
    this.writeShort(this.delay);
    this.out.writeByte(this.transIndex);
    this.out.writeByte(0);
};

GIFEncoder.prototype.writeImageDesc = function() {
    this.out.writeByte(0x2c); // Image Separator
    this.writeShort(0); // Image Position X
    this.writeShort(0); // Image Position Y
    this.writeShort(this.width); // Image Width
    this.writeShort(this.height); // Image Height
    this.out.writeByte(0);
};

GIFEncoder.prototype.writePixels = function() {
    const enc = new LZWEncoder(this.width, this.height, this.indexedPixels, this.colorDepth);
    enc.encode(this.out);
};

// Web Worker message handler
self.onmessage = function(e) {
    const { frames, width, height, quality, delay, repeat, transparent } = e.data;
    
    try {
        const encoder = new GIFEncoder();
        encoder.setRepeat(repeat);
        encoder.setDelay(delay);
        encoder.setQuality(quality);
        encoder.setSize(width, height);
        if (transparent) {
            encoder.setTransparent(0x00000000); // Transparent color
        }
        
        encoder.start();
        
        frames.forEach((frame, index) => {
            const imageData = new ImageData(
                new Uint8ClampedArray(frame.data),
                width,
                height
            );
            encoder.addFrame(imageData);
            
            self.postMessage({
                type: 'progress',
                progress: (index + 1) / frames.length
            });
        });
        
        encoder.finish();
        
        const buffer = encoder.out.getData().buffer;
        self.postMessage({
            type: 'finished',
            buffer: buffer
        }, [buffer]);
        
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: error.message
        });
    }
};
 