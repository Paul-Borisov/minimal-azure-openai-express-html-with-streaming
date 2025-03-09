class AudioStreamingManager {
  constructor(abortController = undefined, handleStop = undefined, sampleRate = 24000, bufferThreshold = 48000) {
    this.sampleRate = sampleRate;
    this.bufferThreshold = bufferThreshold;
    this.audioBuffers = [];
    this.totalSamples = 0;
    this.isProcessing = false;
    this.audioContext = null;
    this.currentSource = null;

    this.abortController = abortController;
    if (this.abortController) {
      this.abortController.signal.addEventListener('abort', () => {
        this.stopPlayback();
      });
    }    
    this.handleStop = handleStop;
  }

  stopPlayback() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
        this.currentSource = null;
      } catch (error) {
        console.error("Audio stop error", error);
      }
    }
    this.audioBuffers = [];
    this.totalSamples = 0;
    this.isProcessing = false;
  }

  base64ToFloat32Array(base64String) {
    let binaryString = atob(base64String);
    // Bug fix for "byte length of Int16Array should be a multiple of 2". Ensure the binary string has an even number of characters.
    if (binaryString.length % 2 !== 0) {
      //binaryString = binaryString.slice(0, -1);
      //binaryString += "\0";
      binaryString += binaryString.length > 0 ? binaryString[binaryString.length-1] : "\0";
    }

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const pcm16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(pcm16Data.length);

    for (let i = 0; i < pcm16Data.length; i++) {
        float32Data[i] = pcm16Data[i] / 32768.0;
    }

    return float32Data;
  }

  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate,
      });
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }    
  }

  async addBuffer(float32Data) {
    this.audioBuffers.push(float32Data);
    this.totalSamples += float32Data.length;

    if (this.totalSamples >= this.bufferThreshold && !this.isProcessing) {
      await this.processBuffers();
    }
  }

  async processBuffers() {
    if (this.audioBuffers.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    await this.initialize();

    try {
      const combinedBuffer = new Float32Array(this.totalSamples);
      let offset = 0;

      for (const buffer of this.audioBuffers) {
        combinedBuffer.set(buffer, offset);
        offset += buffer.length;
      }

      const audioBuffer = this.audioContext.createBuffer(1, combinedBuffer.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(combinedBuffer);

      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);

      this.currentSource.onended = () => {
        this.isProcessing = false;
        if (this.totalSamples >= this.bufferThreshold) {
          this.processBuffers();
        } else {
          if(typeof this.handleStop === "function") this.handleStop();
        }
      };

      this.currentSource.start();
      this.audioBuffers = [];
      this.totalSamples = 0;
    } catch (error) {
      console.error("Audio processing error", error);
      this.isProcessing = false;
    }
  }
}
