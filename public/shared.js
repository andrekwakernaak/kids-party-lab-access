export function connectLabSocket(handlers = {}) {
  const { onState, onStatus } = handlers;
  let socket = null;
  let intentionalClose = false;
  let retryMs = 500;
  let retryTimer = null;

  function setStatus(status) {
    if (typeof onStatus === "function") onStatus(status);
  }

  function scheduleReconnect() {
    if (intentionalClose) return;
    setStatus("reconnecting");
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 1.6, 5000);
  }

  function connect() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    setStatus("connecting");
    socket = new WebSocket(`${protocol}://${location.host}/ws`);

    socket.addEventListener("open", () => {
      retryMs = 500;
      setStatus("connected");
    });

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "state" && typeof onState === "function") {
        onState(message);
      }
    });

    socket.addEventListener("close", () => {
      setStatus("disconnected");
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  function sendAction(action) {
    const payload = JSON.stringify({ type: "action", action });
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      return true;
    }
    return false;
  }

  function destroy() {
    intentionalClose = true;
    clearTimeout(retryTimer);
    if (socket) socket.close();
  }

  connect();

  return { sendAction, destroy };
}

export function createLabSounds() {
  let ctx = null;

  function ensure() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone({ frequency, duration, type = "sine", gain = 0.08, slideTo }) {
    const audio = ensure();
    if (!audio) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    grant() {
      tone({ frequency: 523.25, duration: 0.12, type: "triangle", gain: 0.09 });
      setTimeout(
        () => tone({ frequency: 659.25, duration: 0.12, type: "triangle", gain: 0.09 }),
        90
      );
      setTimeout(
        () => tone({ frequency: 783.99, duration: 0.22, type: "triangle", gain: 0.1 }),
        180
      );
    },
    deny() {
      tone({
        frequency: 180,
        duration: 0.35,
        type: "sawtooth",
        gain: 0.07,
        slideTo: 90,
      });
      setTimeout(
        () =>
          tone({
            frequency: 140,
            duration: 0.45,
            type: "square",
            gain: 0.05,
            slideTo: 70,
          }),
        160
      );
    },
  };
}

export function bindConnectionLabel(el) {
  const labels = {
    connected: "Verbonden",
    connecting: "Verbinden…",
    reconnecting: "Opnieuw verbinden…",
    disconnected: "Verbinding verbroken",
  };

  return (status) => {
    el.dataset.status = status;
    el.querySelector(".conn-text").textContent = labels[status] || status;
  };
}
