import { Engine, EngineOptions } from './types';

// react-native-webrtc is a native module: it works in development/production builds (EAS), not in Expo Go.
let webrtc: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  webrtc = require('react-native-webrtc');
  if (!webrtc?.RTCPeerConnection || !webrtc?.mediaDevices) webrtc = null;
} catch {
  webrtc = null;
}

export const callsSupported = !!webrtc;

export function createEngine(o: EngineOptions): Engine {
  let pc: any = null;
  let stream: any = null;
  const pendingCandidates: any[] = [];

  const flush = async () => {
    while (pc && pendingCandidates.length) await pc.addIceCandidate(new webrtc.RTCIceCandidate(pendingCandidates.shift()));
  };

  return {
    async start() {
      stream = await webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
      pc = new webrtc.RTCPeerConnection({ iceServers: o.iceServers });
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
      pc.addEventListener('icecandidate', (e: any) => {
        if (e.candidate) o.onSignal({ type: 'candidate', candidate: e.candidate.toJSON() });
      });
      pc.addEventListener('connectionstatechange', () => {
        if (pc?.connectionState === 'connected') o.onConnected();
        if (pc?.connectionState === 'failed') o.onFailed();
      });
      if (o.isCaller) {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        o.onSignal({ type: 'offer', sdp: offer.sdp });
      }
    },

    async handleSignal(data) {
      if (!pc) return;
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        o.onSignal({ type: 'answer', sdp: answer.sdp });
        await flush();
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        await flush();
      } else if (data.type === 'candidate') {
        if (pc.remoteDescription) await pc.addIceCandidate(new webrtc.RTCIceCandidate(data.candidate));
        else pendingCandidates.push(data.candidate);
      }
    },

    setMuted(muted) {
      stream?.getAudioTracks().forEach((t: any) => (t.enabled = !muted));
    },

    close() {
      stream?.getTracks().forEach((t: any) => t.stop());
      pc?.close();
      pc = null;
      stream = null;
    },
  };
}
