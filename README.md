# Lab Access Control

Laboratorium-themed access control screen for a kids party. One device shows a dramatic grant/deny
display with sound a phone acts as the remote.

## Party-day setup

1. Laptop and phone on the **same Wi‑Fi**.
2. In this folder:

```bash
npm install
npm start
```

3. On the TV / projector / laptop browser, open the **display** URL printed in the terminal, for example:

   `http://192.168.x.x:3000/display`

   Put the browser in fullscreen (F11).

4. On the phone, open the **control** URL from the terminal:

   `http://192.168.x.x:3000/control`

5. Tap **Toegang** (green) or **Geweigerd** (red) as kids present their lab passes. The display resets to idle after about 5 seconds.

Local-only shortcuts:

- Display: `http://localhost:3000/display`
- Control: `http://localhost:3000/control`

## Notes

- Sounds use the Web Audio API (no audio files). Tap or click the display once if the browser blocks audio until user interaction.
- The server listens on all interfaces (`0.0.0.0:3000`) so phones on the LAN can connect.
- Optional: set `PORT=8080 npm start` to use another port.
