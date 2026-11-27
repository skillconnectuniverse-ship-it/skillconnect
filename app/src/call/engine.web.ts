import { Engine, EngineOptions } from './types';

// Browser WebRTC: audio only, peer-to-peer; signalling goes through the backend socket.
export const callsSupported =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined';

export function createEngine(o: EngineOptions): Engine {
  let pc: RTCPeerConnection | null = null;
  let stream: MediaStream | null = null;
  let audio: HTMLAudioElement | null = null;
  const pendingCandidates: RTCIceCandidateInit[] = [];

  const flush = async () => {
    while (pc && pendingCandidates.length) await pc.addIceCandidate(pendingCandidates.shift()!);
  };

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc = new RTCPeerConnection({ iceServers: o.iceServers });
      stream.getTracks().forEach((t) => pc!.addTrack(t, stream!));
      pc.onicecandidate = (e) => {
        if (e.candidate) o.onSignal({ type: 'candidate', candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        audio = audio ?? document.createElement('audio');
        audio.autoplay = true;
        audio.srcObject = e.streams[0];
        document.body.appendChild(audio);
        audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc?.connectionState === 'connected') o.onConnected();
        if (pc?.connectionState === 'failed') o.onFailed();
      };
      if (o.isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        o.onSignal({ type: 'offer', sdp: offer.sdp });
      }
    },

    async handleSignal(data) {
      if (!pc) return;
      if (data.type === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        o.onSignal({ type: 'answer', sdp: answer.sdp });
        await flush();
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await flush();
      } else if (data.type === 'candidate') {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
        else pendingCandidates.push(data.candidate);
      }
    },

    setMuted(muted) {
      stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    },

    close() {
      stream?.getTracks().forEach((t) => t.stop());
      pc?.close();
      audio?.remove();
      pc = null;
      stream = null;
      audio = null;
    },
  };
}
