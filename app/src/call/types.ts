export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface EngineOptions {
  iceServers: IceServer[];
  isCaller: boolean;
  onSignal: (data: unknown) => void;
  onConnected: () => void;
  onFailed: () => void;
}

export interface Engine {
  start: () => Promise<void>;
  handleSignal: (data: any) => Promise<void>;
  setMuted: (muted: boolean) => void;
  close: () => void;
}
