# phone-sensors



What happens on the weekend in twenty and twenty six, when walking along the beach you see a distant camera flash? You remember the time you were in a stadium trying to find a friend, but the cell network was jammed by eighty thousand people. Flash your cell phone light to locate them, and then wish you had the time to build an app that transmitted and recieved messages with a morse code light via cell phone camera. This weekend, we go down that rabbit hole of sensors with Claude taking the time to build.

Twenty-seven small HTML files exploring what a smartphone's sensors can do from inside a browser. No apps, no installs, no servers.

**Live demos:** [tautme.github.io/phone-sensors](https://tautme.github.io/phone-sensors/)

## How this started

I wanted to understand what was actually behind the privacy permission prompts on my phone — the ones you tap through dozens of times a week without thinking. *Allow this site to access your microphone? Camera? Motion sensors?* What can a website really do with those, and how much is gated, how much is exposed, how much is somewhere in between?

Reading documentation answered some of it. Building things answered the rest. So I started writing tiny single-file web apps, one per sensor, just to see what was reachable. Each one began as a literal test ("can a webpage really read the magnetometer?") and turned into something I wanted to keep using.

Once each sensor was working, the next question was the more interesting one: *what could you make with it that isn't useful?* Sensors get used for fitness apps, navigation, video calls — the obvious productive things. They're rarely used for art, music, play. So most of these demos lean that direction. A drawing tool you control by tilting the phone. A spectrogram of the magnetic field around you. A painting-and-violin performance driven by everything the phone can sense at once.

The result is a small map of where the boundaries of the modern web platform actually are, drawn from the inside.

## The demos

[`index.html`](https://tautme.github.io/phone-sensors/) is the **canonical catalog** — every card is rendered from a single inline JSON inventory, and it feature-detects your device's APIs on load (detection only, no permission prompts). The table below is generated from that same inventory, so the two never disagree.

| File | Category | Sensors / APIs | Permission | What it does |
|---|---|---|---|---|
| `inertial-etch.html` | Motion | DeviceMotion, DeviceOrientation | gated | Etch-A-Sketch driven by tilting the phone. |
| `inertial-blueprint.html` | Motion | DeviceMotion, DeviceOrientation | gated | Pedestrian dead reckoning: walk a room and it draws the blueprint, no GPS. |
| `accel-tuner.html` | Motion | DeviceMotion | gated | Tune a guitar by pressing the phone to its body and reading string vibration. |
| `gait-fingerprint.html` | Motion | DeviceMotion | gated | Walk 30 s; your step pattern becomes a saveable, comparable fingerprint. |
| `magnetometer-waterfall.html` | Motion | Magnetometer | silent | FFT spectrogram of the local magnetic field — motors, magnets, electronics made visible. |
| `guitar-tuner.html` | Audio | Microphone, Web Audio | gated | Pitch detector with a waterfall display and a tuned-in confirmation. |
| `mic-range.html` | Audio | Microphone, Web Audio | gated | Live FFT waterfall plus max-hold response curve, AGC/NS/EC disabled. |
| `hearing-range.html` | Audio | Web Audio | none | Log-scale tone generator, 20 Hz–22 kHz; sweep and mark your hearing floor and ceiling. |
| `echolocation.html` | Audio | Microphone, Web Audio | gated | Speaker chirp + cross-correlation: distance to walls from echo time-of-flight. |
| `morse-listener.html` | Audio | Microphone, Web Audio | gated | Decodes Morse code from audio tones, with adaptive dot timing. |
| `morse-transmit.html` | Audio | Web Audio | none | Sends text as Morse audio tones; optional Vigenère cipher layer. |
| `morse-listencrypt.html` | Audio | Microphone, Web Audio | gated | Tone-filtered Morse decoder with optional Vigenère decryption; pairs with the transmitter. |
| `object-vision.html` | Camera/Vision | Camera, WebGL | gated | Names objects in the camera view — COCO-SSD via TF.js, in the browser. *(loads a CDN model)* |
| `count-vision.html` | Camera/Vision | Camera, WebGL | gated | Object detection with a running tally of everything the camera has seen. *(loads a CDN model)* |
| `morse-vision.html` | Camera/Vision | Camera | gated | Decodes Morse from a flashing light, with percentile auto-thresholding. |
| `morse-light.html` | Camera/Vision | Camera, Torch | gated | Types text into Morse and blinks the rear flashlight via the torch constraint. |
| `heartRate.html` | Camera/Vision | Camera, Torch (optional) | gated | Fingertip over the lens; flash-lit photoplethysmography reads your pulse in BPM. |
| `ocr-vision.html` | Camera/Vision | Camera, WASM | gated | Book-spine OCR (Tesseract.js) with a side-by-side comparison view. *(loads a CDN model)* |
| `ocr_vision_count.html` | Camera/Vision | Camera, WASM | gated | Multi-spine OCR with a running count of titles read. *(loads a CDN model)* |
| `ocr-spine-select.html` | Camera/Vision | Camera, WASM | gated | Multi-spine OCR with manual region selection before recognition. *(loads a CDN model)* |
| `bluetooth-reader.html` | Radio/Network | Web Bluetooth | gated | Connects to BLE devices and streams live GATT sensor characteristics. |
| `connection-health.html` | Radio/Network | Network Info (optional) | silent | Pings + speed tests over time with charts; reads connection type with no prompt. |
| `sensor-etch.html` | Multi-sensor | DeviceMotion, DeviceOrientation, Microphone, Web Audio | gated | Painting + synthesized violin driven by everything the phone can sense at once. |
| `sensor_etch_pixel.html` | Multi-sensor | DeviceMotion, DeviceOrientation, Microphone, Web Audio | gated | Sensor Etch in artist mode — pixel canvas variant; whistle to change brush size. |
| `qa_llm.html` | Tours/Meta | WASM | none | Document Q&A with citation jumps; a Transformers.js model runs entirely in your browser. *(loads a CDN model)* |
| `product_tour.html` | Tours/Meta | — | none | Walkthrough of how Sensor Etch works, sensor by sensor. |
| `tech_tour.html` | Tours/Meta | — | none | Tour of the electronics and music inside the instrument. |

## What's reachable, what isn't

Some of the most interesting findings were the gaps. The phone has a barometer, a heart rate sensor (sometimes), a LiDAR scanner (on Pro iPhones), can see WiFi networks and cell towers — but the browser can reach almost none of these. Each gap is a privacy decision: WiFi scan results would let any page geolocate you within meters, indoors, silently. Cell tower IDs would do the same.

Roughly:

| Sensor | Web access? |
|---|---|
| Camera, microphone | Yes, with permission |
| Accelerometer, gyroscope, compass | Yes, with permission (iOS asks once) |
| Magnetometer (raw) | Chrome only, with permission |
| GPS | Yes, standard `geolocation` API |
| Bluetooth LE | Yes on Chrome, **not on iOS Safari** |
| WiFi scanning | No, anywhere |
| Cell tower / signal strength | No, anywhere |
| Barometer (pressure) | No |
| Heart rate / SpO2 | No (native apps only) |
| LiDAR depth | No |
| Fingerprint / Face ID | Authentication only via WebAuthn, no raw access |

iOS Safari is the limiting factor for several APIs. If you only care about cross-platform reach, the lowest common denominator is camera, mic, geolocation, and the legacy `deviceorientation`/`devicemotion` events.

## Running locally

```bash
git clone https://github.com/tautme/phone-sensors.git
cd phone-sensors
python3 -m http.server
```

Then open `http://localhost:8000` in your phone's browser **on the same WiFi network**. Most sensor APIs require either `localhost` or HTTPS, so you can't just open the files with `file://`.

For testing on a phone over your local network, the easiest options are:
- **GitHub Pages** — deploy this repo and you get a free HTTPS URL.
- **ngrok** — `ngrok http 8000` gives you a public HTTPS tunnel to your local server.
- **Tailscale** — if both devices are on your tailnet, you can use the local IP directly.

## Browser compatibility

Each demo lists its requirements at the bottom of the page. Quick summary:

- **Works everywhere modern:** Morse Listener, Inertial Etch, Object Vision, Count Vision, Connection Health.
- **Chrome/Edge only:** Bluetooth Reader, Magnetometer Waterfall.
- **iOS quirks:** Sensor APIs require a single user gesture before they'll grant permission, and `Magnetometer`/`Bluetooth` aren't supported at all.
- **Android Chrome** is the most permissive runtime — everything works.

## Is it safe to share?

Yes. Each file is self-contained, runs entirely in the visitor's browser, and ships nothing back. Permissions for camera, mic, motion, and Bluetooth are granted per-origin by the user via a system dialog. Browsers show indicator icons (red dot, mic icon) whenever camera or microphone are active.

The only practical caution: host on a clean static origin. Don't drop these files into a domain that also serves third-party tracking scripts you don't control, since those would inherit the same-origin permissions. GitHub Pages, Netlify, Cloudflare Pages, and your own static hosting are all fine.

## Architecture notes

Every file is hand-written, no build step, no bundler, no framework. Open in a browser, read the source, change a line, refresh. This was a deliberate constraint — partly to keep them readable, partly to make the file size honest. The largest demo is about 15 KB; the heaviest dependency is COCO-SSD's ~5 MB model in `object-vision.html` and `count-vision.html`, loaded from a CDN.

Some specific techniques worth pointing out if you read the code:

- **Adaptive timing in the Morse decoders.** The shortest pulse seen so far is treated as the dot reference; everything else snaps relative to it. This is what lets the audio decoder handle Farnsworth-timed practice files where dots are fast but gaps are stretched.
- **Auto-thresholding in `morse-vision.html`.** Instead of a fixed brightness cutoff, it tracks the 10th and 90th percentile of recent samples and puts the threshold at the midpoint. The "on" level adapts to whatever the camera is pointed at.
- **Pedestrian dead reckoning in `inertial-blueprint.html`.** Acceleration peak detection produces step events, compass heading gives direction, configurable step length gives distance. Drift is real — usually 10-20% over a single room — but it works in a building with no GPS reference.
- **Procedural reverb in `sensor-etch.html`.** A `ConvolverNode` with a programmatically generated impulse response (exponentially decaying noise) gives a serviceable reverb without any audio asset.
- **Two AudioContexts** in `sensor-etch.html` keep the input mic and the output synth on separate graphs, so there's no chance of feedback loops at the API level (only acoustic feedback through speakers).

## License

MIT. Fork freely, modify freely, ship whatever.

## Acknowledgments

Built iteratively with [Claude](https://claude.ai/). The collaboration model that produced these worked well: I'd describe what I wanted to explore, the model would write the file, I'd test it on my phone and report back what was broken or surprising, we'd iterate. Many of the technical choices in here — adaptive thresholds, the Farnsworth timing fix, the percussion sensitivity tuning — came out of that loop.

If you build something interesting on top of these, open an issue or send a pull request. I'd love to see what you make.
