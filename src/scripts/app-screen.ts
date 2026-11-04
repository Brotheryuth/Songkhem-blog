// The songKHEM Android app, drawn on a canvas for the 3D phone's screen. Every size, colour, font and icon
// comes from the app's own code (OCR-for-impaired-user/mobile/src: theme/tokens.js, theme/shell.js,
// components/AppHeader.js, navigation/MainTabs.js, components/CameraCapture.js, components/ProcessingCard.js,
// screens/ReaderScreen.js), in light theme, laid out in Android dp on a 411 dp wide phone like the one the
// app was tested on (1080 x 2400 at 420 dpi).

/** Screen width in dp. The height follows the 3D screen's shape (the app's layout is all flex). */
export const UW = 411;

export type AppText = {
  search: string;
  further: string;
  found: string;
  camera: string;
  upload: string;
  history: string;
  scanningTitle: string;
  scanningDesc: string;
  progress: string;
  readerTitle: string;
  voice: string;
};

export type AppState = {
  /** 0 = camera tab, 1 = reader (they cross-fade through a blank screen) */
  reader: number;
  guide: 'search' | 'further' | 'found';
  /** The page outline the app draws, as 0..1 points across the camera view, or null when no page is found */
  outline: { x: number; y: number }[] | null;
  tap: number;
  flash: number;
  /** 0..1 how far the processing card has replaced the camera */
  scan: number;
  scanProgress: number;
  /** Word being read (-1 before reading starts) */
  word: number;
  read: number;
};

// ---------- Tokens (theme/tokens.js light, theme/shell.js light) ----------
const C = {
  bg: '#F8FAFC',
  surface1: '#F8FAFC',
  onSurface: '#0F172A',
  onSurfaceMuted: '#334155',
  primary: '#4466F6',
  primaryPressed: '#3353E2',
  divider: '#CBD5E1',
  borderSubtle: '#E2E8F0',
  textPrimary: '#0A1628',
  textSecondary: '#1E293B',
  bgSurfaceElevated: '#EEF2FF',
  headerBg: '#FFFFFF',
  headerBorder: 'rgba(0,0,0,0.08)',
  brand: '#1F1F1F',
  icon: '#444746',
  navBg: '#F0F4F9',
  navBorder: 'rgba(0,0,0,0.08)',
  tab: '#444746',
  pill: '#C2E7FF',
  pillIcon: '#041E49',
  labelActive: '#041E49',
  highlight: '#FEF08A',
  outline: '#EF4444',
};

// Android's own fonts for text the app leaves unstyled (Roboto, and Noto Sans Khmer for Khmer), and the
// app's Suwannaphum for document and reader text.
const SYSTEM = '"Roboto", "Noto Sans Khmer", sans-serif';
const SUWAN = '"Suwannaphum", "Noto Sans Khmer", serif';
export const APP_FONTS = [
  `400 16px ${SUWAN}`,
  `700 16px ${SUWAN}`,
  '400 16px "Noto Sans Khmer"',
  '500 16px "Noto Sans Khmer"',
  '600 16px "Noto Sans Khmer"',
  '400 16px "Roboto"',
  '500 16px "Roboto"',
  '600 16px "Roboto"',
];
export const APP_FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;500;600&family=Roboto:wght@400;500;600;700&family=Suwannaphum:wght@400;700&display=swap';

// ---------- Icons: lucide-react-native 1.47.0 (ISC), exactly as the app uses them ----------
export type IconNode = [string, Record<string, string>][];
export const ICONS: Record<string, IconNode> = {
  languages: [['path', { d: 'm5 8 6 6' }], ['path', { d: 'm4 14 6-6 2-3' }], ['path', { d: 'M2 5h12' }], ['path', { d: 'M7 2h1' }], ['path', { d: 'm22 22-5-10-5 10' }], ['path', { d: 'M14 18h6' }]],
  help: [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }], ['path', { d: 'M12 17h.01' }]],
  settings: [['path', { d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915' }], ['circle', { cx: '12', cy: '12', r: '3' }]],
  scan: [['path', { d: 'M3 7V5a2 2 0 0 1 2-2h2' }], ['path', { d: 'M17 3h2a2 2 0 0 1 2 2v2' }], ['path', { d: 'M21 17v2a2 2 0 0 1-2 2h-2' }], ['path', { d: 'M7 21H5a2 2 0 0 1-2-2v-2' }]],
  camera: [['path', { d: 'M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z' }], ['circle', { cx: '12', cy: '13', r: '3' }]],
  upload: [['path', { d: 'M12 3v12' }], ['path', { d: 'm17 8-5-5-5 5' }], ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }]],
  history: [['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }], ['path', { d: 'M3 3v5h5' }], ['path', { d: 'M12 7v5l4 2' }]],
  sparkles: [['path', { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' }], ['path', { d: 'M20 2v4' }], ['path', { d: 'M22 4h-4' }], ['circle', { cx: '4', cy: '20', r: '2' }]],
  back: [['path', { d: 'm12 19-7-7 7-7' }], ['path', { d: 'M19 12H5' }]],
  volume: [['path', { d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' }], ['path', { d: 'M16 9a5 5 0 0 1 0 6' }], ['path', { d: 'M19.364 18.364a9 9 0 0 0 0-12.728' }]],
  more: [['circle', { cx: '12', cy: '12', r: '1' }], ['circle', { cx: '19', cy: '12', r: '1' }], ['circle', { cx: '5', cy: '12', r: '1' }]],
  skipBack: [['path', { d: 'M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z' }], ['path', { d: 'M3 20V4' }]],
  skipForward: [['path', { d: 'M21 4v16' }], ['path', { d: 'M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z' }]],
  pause: [['rect', { x: '14', y: '3', width: '5', height: '18', rx: '1' }], ['rect', { x: '5', y: '3', width: '5', height: '18', rx: '1' }]],
  play: [['path', { d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' }]],
};
// The reader's floating button icon (the website's src/assets/signalIcon.svg, 41 x 51)
export const SIGNAL = [
  'M20.4892 48.7796C22.9181 48.7311 25.3137 48.2046 27.5393 47.2302C29.7648 46.2559 31.7766 44.8527 33.4598 43.1008C35.143 41.349 36.4647 39.2827 37.3494 37.0201C38.2341 34.7575 38.6645 32.3427 38.6159 29.9137L38.4105 19.6298C38.3199 15.0859 36.56 10.7344 33.4663 7.40511M1.49989 24.475L1.62331 30.6528C1.69482 34.294 2.83943 37.833 4.91371 40.8265C6.98798 43.8199 9.89964 46.1345 13.2838 47.4802M28.8423 3.79675C24.5451 1.42897 19.4833 0.865176 14.7704 2.22939C10.0575 3.5936 6.07957 6.77407 3.7116 11.0712C2.73584 12.8354 2.06117 14.75 1.71536 16.7362',
  'M17.8357 12.2692C19.1906 11.9595 20.5978 11.9579 21.9534 12.2646C23.309 12.5712 24.5786 13.1781 25.6684 14.0407C26.7582 14.9033 27.6405 15.9995 28.2503 17.2484C28.86 18.4974 29.1817 19.8673 29.1915 21.2571L29.3105 27.213M27.0981 35.0287C25.8675 36.4559 24.2303 37.4731 22.4057 37.9443C20.581 38.4155 18.656 38.3181 16.8882 37.6652C15.1204 37.0123 13.5942 35.835 12.5139 34.291C11.4335 32.7469 10.8506 30.9097 10.843 29.0252L10.6952 21.6267C10.6596 20.356 10.8863 19.0917 11.3611 17.9126M19.9515 21.8488L20.0749 28.0266',
];

const pathCache = new Map<string, Path2D>();
const path2d = (d: string) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

/** A lucide icon centred on (cx, cy), `size` dp, stroke 2 in its 24-unit box, like lucide-react-native. */
function icon(c: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, color: string, fill?: string) {
  const k = size / 24;
  c.save();
  c.translate(cx - size / 2, cy - size / 2);
  c.scale(k, k);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const [tag, a] of ICONS[name]) {
    let p: Path2D;
    if (tag === 'path') p = path2d(a.d);
    else if (tag === 'circle') {
      p = new Path2D();
      p.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
    } else {
      p = new Path2D();
      p.roundRect(+a.x, +a.y, +a.width, +a.height, +(a.rx ?? 0));
    }
    if (fill) {
      c.fillStyle = fill;
      c.fill(p);
    }
    c.stroke(p);
  }
  c.restore();
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Android elevation, roughly: a soft shadow under what is drawn next. */
function elevation(c: CanvasRenderingContext2D, dp: number) {
  c.shadowColor = `rgba(0, 0, 0, ${0.12 + dp * 0.025})`;
  c.shadowBlur = dp * 1.6;
  c.shadowOffsetY = dp * 0.5;
}
function noShadow(c: CanvasRenderingContext2D) {
  c.shadowColor = 'transparent';
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;
}

/** One line of text, cut with an ellipsis if it is wider than `max` (React Native's numberOfLines={1}). */
function fitLine(c: CanvasRenderingContext2D, text: string, max: number) {
  if (c.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

const formatTime = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

export function createAppScreen(UH: number, scale: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(UW * scale);
  canvas.height = Math.round(UH * scale);
  const c = canvas.getContext('2d')!;

  // Fixed parts of the layout, in dp (from the app's styles; measured against its screenshots)
  const STATUS = 48; // Android status bar
  const INSET = 24; // gesture navigation inset at the bottom
  const HEADER = STATUS + 64; // AppHeader: 64 tall
  const TABS = UH - 80 - INSET; // PillTabBar: 80 tall plus the inset
  // CameraScreen wrapper (8) + deck (8) around the camera frame, which has a 2 dp border and 12 dp corners
  const frame = { x: 16, y: HEADER + 16, w: UW - 32, h: TABS - 16 - (HEADER + 16), r: 12 };
  const viewfinder = { x: frame.x + 2, y: frame.y + 2, w: frame.w - 4, h: frame.h - 4, r: 10 };

  const logo = new Image();
  const logoReady = new Promise<void>((resolve) => {
    logo.onload = () => resolve();
    logo.onerror = () => resolve();
  });
  logo.src = '/app-ui/logo-mark.png';

  const statusBar = (bg: string) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, UW, STATUS);
    c.fillStyle = '#1F1F1F';
    c.font = `400 14.5px "Roboto", sans-serif`;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText('9:41', 31, 25);
    // Wi-Fi, mobile signal and battery, as Android draws them
    const y = 25;
    c.beginPath();
    c.moveTo(346, y + 6.5);
    c.lineTo(337.5, y - 2.5);
    c.arc(346, y + 6.5, 12, (-3 * Math.PI) / 4, -Math.PI / 4);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(353, y + 6.5);
    c.lineTo(364, y + 6.5);
    c.lineTo(364, y - 5.5);
    c.closePath();
    c.fill();
    rrect(c, 371, y - 7, 8, 14, 1.5);
    c.fill();
    c.fillRect(373, y - 8.5, 4, 2);
  };

  const navHandle = () => {
    c.fillStyle = '#1F1F1F';
    rrect(c, UW / 2 - 54, UH - 12.5, 108, 4, 2);
    c.fill();
  };

  const header = () => {
    c.fillStyle = C.headerBg;
    c.fillRect(0, 0, UW, HEADER);
    statusBar(C.headerBg);
    c.fillStyle = C.headerBorder;
    c.fillRect(0, HEADER - 1, UW, 1);
    const cy = STATUS + 32;
    if (logo.complete && logo.naturalWidth) c.drawImage(logo, 16 + 2, cy - 16, 32, 32);
    c.fillStyle = C.brand;
    c.font = `600 20px "Roboto", sans-serif`;
    c.letterSpacing = '-0.2px';
    c.textBaseline = 'middle';
    c.fillText('SongKhem', 64, cy + 1);
    c.letterSpacing = '0px';
    icon(c, 'settings', UW - 16 - 22, cy, 22, C.icon);
    icon(c, 'help', UW - 16 - 22 - 48, cy, 22, C.icon);
    icon(c, 'languages', UW - 16 - 22 - 96, cy, 22, C.icon);
  };

  const tabBar = (text: AppText) => {
    c.fillStyle = C.navBg;
    c.fillRect(0, TABS, UW, UH - TABS);
    c.fillStyle = C.navBorder;
    c.fillRect(0, TABS, UW, 1);
    // Three tabs at most 120 wide, spaced around inside 16 dp padding
    const inner = UW - 32;
    const tabW = Math.min(120, inner / 3);
    const gap = (inner - tabW * 3) / 6;
    const tabs: [string, string][] = [['camera', text.camera], ['upload', text.upload], ['history', text.history]];
    tabs.forEach(([name, label], i) => {
      const cx = 16 + gap + tabW / 2 + i * (tabW + gap * 2);
      const top = TABS + (80 - 52) / 2;
      const focused = i === 0;
      if (focused) {
        c.fillStyle = C.pill;
        rrect(c, cx - 32, top, 64, 32, 16);
        c.fill();
      }
      icon(c, name, cx, top + 16, 24, focused ? C.pillIcon : C.tab);
      c.fillStyle = focused ? C.labelActive : C.tab;
      c.font = `${focused ? 600 : 500} 12px ${SYSTEM}`;
      c.letterSpacing = '0.1px';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, cx, top + 32 + 4 + 8);
      c.letterSpacing = '0px';
      c.textAlign = 'left';
    });
    navHandle();
  };

  const camera = (s: AppState, text: AppText) => {
    c.fillStyle = C.bg;
    c.fillRect(0, 0, UW, UH);
    header();
    // Deck behind the frame (surface1, 16 dp corners), then the frame's border round the camera view
    c.fillStyle = C.surface1;
    rrect(c, 8, HEADER + 8, UW - 16, TABS - 8 - (HEADER + 8), 16);
    c.fill();
    c.fillStyle = C.borderSubtle;
    rrect(c, frame.x, frame.y, frame.w, frame.h, frame.r);
    c.fill();
    // The camera picture shows through this hole (it is drawn by the 3D scene underneath)
    c.save();
    rrect(c, viewfinder.x, viewfinder.y, viewfinder.w, viewfinder.h, viewfinder.r);
    c.globalCompositeOperation = 'destination-out';
    c.fill();
    c.restore();

    c.save();
    rrect(c, viewfinder.x, viewfinder.y, viewfinder.w, viewfinder.h, viewfinder.r);
    c.clip();
    // Red outline round the page the app found
    if (s.outline) {
      c.strokeStyle = C.outline;
      c.lineWidth = 4;
      c.lineJoin = 'round';
      c.beginPath();
      s.outline.forEach((p, i) => {
        const x = viewfinder.x + p.x * viewfinder.w;
        const y = viewfinder.y + p.y * viewfinder.h;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.closePath();
      c.stroke();
    }

    // Guidance chip: centred pill, one line
    const message = s.guide === 'found' ? text.found : s.guide === 'further' ? text.further : text.search;
    c.font = `500 13.6px ${SYSTEM}`;
    c.letterSpacing = '0.1px';
    const maxText = viewfinder.w - 24 - 2 - 28 - 26 - 8;
    const line = fitLine(c, message, maxText);
    const textW = c.measureText(line).width;
    const pillW = 1 + 14 + 26 + 8 + textW + 14 + 1;
    const pillH = 42;
    const px = UW / 2 - pillW / 2;
    const py = viewfinder.y + 14;
    elevation(c, 6);
    c.fillStyle = 'rgba(23,27,34,0.85)';
    rrect(c, px, py, pillW, pillH, pillH / 2);
    c.fill();
    noShadow(c);
    c.strokeStyle = 'rgba(255,255,255,0.16)';
    c.lineWidth = 1;
    rrect(c, px + 0.5, py + 0.5, pillW - 1, pillH - 1, pillH / 2);
    c.stroke();
    c.fillStyle = 'rgba(168,199,250,0.16)';
    c.beginPath();
    c.arc(px + 15 + 13, py + pillH / 2, 13, 0, Math.PI * 2);
    c.fill();
    icon(c, 'scan', px + 15 + 13, py + pillH / 2, 18, '#A8C7FA');
    c.fillStyle = '#FFFFFF';
    c.textBaseline = 'middle';
    c.fillText(line, px + 15 + 26 + 8, py + pillH / 2 + 0.5);
    c.letterSpacing = '0px';

    // Shutter: 64 dp ring (4 dp white border, 20% white inside), 4 dp gap, white disc; pressing it dims it
    const sx = UW / 2;
    const sy = viewfinder.y + viewfinder.h - 14 - 32;
    const base = c.globalAlpha;
    c.globalAlpha = base * (1 - 0.25 * s.tap);
    elevation(c, 6);
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.beginPath();
    c.arc(sx, sy, 32, 0, Math.PI * 2);
    c.fill();
    noShadow(c);
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(sx, sy, 30, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(sx, sy, 24 * (1 - 0.06 * s.tap), 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = base;

    if (s.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${0.7 * s.flash})`;
      c.fillRect(viewfinder.x, viewfinder.y, viewfinder.w, viewfinder.h);
    }
    c.restore();

    // ProcessingCard replaces the camera deck while the text is read from the photo
    if (s.scan > 0) {
      c.globalAlpha = base * s.scan;
      c.fillStyle = C.bg;
      c.fillRect(0, HEADER, UW, TABS - HEADER);
      processing(s, text);
      c.globalAlpha = base;
    }
    tabBar(text);
  };

  const wrap = (words: string[], max: number, joiner = ' ') => {
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + joiner + w : w;
      if (line && c.measureText(next).width > max) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  const processing = (s: AppState, text: AppText) => {
    const x = 8;
    const w = UW - 16;
    const top = HEADER + 8 + 10;
    const inner = w - 4 - 40;
    c.font = `400 18.5px ${SUWAN}`;
    const desc = wrap(text.scanningDesc.split(' '), inner);
    const pct = Math.round(s.scanProgress * 100);
    // padding 32, then icon 72, title, description (30 dp lines), bar, progress text, with 18 dp between
    const h = 2 + 32 + 72 + 18 + 36 + 18 + desc.length * 30 + 18 + 10 + 18 + 22 + 32 + 2;
    c.fillStyle = C.surface1;
    rrect(c, x, top, w, h, 16);
    c.fill();
    c.strokeStyle = C.borderSubtle;
    c.lineWidth = 2;
    rrect(c, x + 1, top + 1, w - 2, h - 2, 15);
    c.stroke();
    let y = top + 2 + 32;
    elevation(c, 4);
    c.fillStyle = C.primary;
    c.beginPath();
    c.arc(UW / 2, y + 36, 36, 0, Math.PI * 2);
    c.fill();
    noShadow(c);
    icon(c, 'sparkles', UW / 2, y + 36, 36, '#FFFFFF');
    y += 72 + 18;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = C.textPrimary;
    c.font = `700 24px ${SUWAN}`;
    c.fillText(text.scanningTitle, UW / 2, y + 18);
    y += 36 + 18;
    c.fillStyle = C.textSecondary;
    c.font = `400 18.5px ${SUWAN}`;
    desc.forEach((l, i) => c.fillText(l, UW / 2, y + 15 + i * 30));
    y += desc.length * 30 + 18 + 4;
    const barW = Math.min(320, inner);
    c.fillStyle = C.bgSurfaceElevated;
    rrect(c, UW / 2 - barW / 2, y, barW, 6, 3);
    c.fill();
    c.fillStyle = C.primary;
    rrect(c, UW / 2 - barW / 2, y, Math.max(6, barW * s.scanProgress), 6, 3);
    c.fill();
    y += 6 + 18;
    c.fillStyle = C.primary;
    c.font = `600 16px ${SUWAN}`;
    c.fillText(text.progress.replace('{n}', String(pct)), UW / 2, y + 11);
    c.textAlign = 'left';
  };

  const reader = (s: AppState, text: AppText, paragraphs: string[][]) => {
    c.fillStyle = C.bg;
    c.fillRect(0, 0, UW, UH);
    statusBar(C.bg);
    // Top bar: back, title, settings
    const top = STATUS;
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, top, UW, 56);
    c.fillStyle = C.divider;
    c.fillRect(0, top + 55, UW, 1);
    icon(c, 'back', 8 + 24, top + 28, 24, C.onSurface);
    icon(c, 'settings', UW - 8 - 24, top + 28, 22, C.onSurface);
    c.fillStyle = C.onSurface;
    c.font = `700 19px ${SUWAN}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text.readerTitle, UW / 2, top + 28);
    c.textAlign = 'left';

    // Document text: Suwannaphum 18, line height 1.85, 20 dp padding, 24 dp between paragraphs; each word
    // is its own span with a trailing space, and the word being read gets the yellow highlight
    c.font = `400 18px ${SUWAN}`;
    const lineH = 18 * 1.85;
    const space = c.measureText(' ').width;
    let y = top + 56 + 20;
    let index = 0;
    for (const para of paragraphs) {
      let x = 20;
      for (const word of para) {
        const w = c.measureText(word).width;
        if (x > 20 && x + w > UW - 20) {
          x = 20;
          y += lineH;
        }
        if (index === s.word) {
          c.fillStyle = C.highlight;
          c.fillRect(x, y, w + space, lineH);
        }
        c.fillStyle = C.onSurface;
        c.textBaseline = 'middle';
        c.fillText(word, x, y + lineH / 2);
        x += w + space;
        index++;
      }
      y += lineH + 24;
    }

    // Player bar (194 dp with the gesture inset)
    const T = UH - 194;
    // Floating actions button, 16 dp above the player bar
    elevation(c, 6);
    c.fillStyle = C.primary;
    c.beginPath();
    c.arc(UW - 18 - 28, T - 16 - 28, 28, 0, Math.PI * 2);
    c.fill();
    noShadow(c);
    c.strokeStyle = C.primaryPressed;
    c.lineWidth = 1;
    c.stroke();
    c.save();
    const k = 28 / 51;
    c.translate(UW - 18 - 28 - (41 * k) / 2, T - 16 - 28 - 14);
    c.scale(k, k);
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    SIGNAL.forEach((d) => c.stroke(path2d(d)));
    c.restore();

    elevation(c, 4);
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, T, UW, UH - T);
    noShadow(c);
    c.fillStyle = C.divider;
    c.fillRect(0, T, UW, 1);
    // Voice tag and "more"
    const hy = T + 8 + 22;
    c.font = `700 12px ${SUWAN}`;
    const tagW = 10 + 15 + 6 + c.measureText(text.voice).width + 10;
    c.fillStyle = 'rgba(148,163,184,0.14)';
    rrect(c, 20, hy - 15, tagW, 30, 15);
    c.fill();
    icon(c, 'volume', 20 + 10 + 7.5, hy, 15, C.onSurfaceMuted);
    c.fillStyle = C.onSurfaceMuted;
    c.textBaseline = 'middle';
    c.fillText(text.voice, 20 + 10 + 15 + 6, hy + 0.5);
    icon(c, 'more', UW - 16 - 4 - 22, hy, 20, C.onSurfaceMuted);
    // Progress track
    const ty = T + 8 + 44 + 4 + 14;
    const tx = 16;
    const tw = UW - 32;
    c.fillStyle = 'rgba(148,163,184,0.35)';
    rrect(c, tx, ty - 2, tw, 4, 2);
    c.fill();
    c.fillStyle = C.primary;
    rrect(c, tx, ty - 2, tw * s.read, 4, 2);
    c.fill();
    elevation(c, 2);
    c.beginPath();
    c.arc(tx + tw * s.read, ty, 6, 0, Math.PI * 2);
    c.fill();
    noShadow(c);
    // Times: about 2.5 words a second, as the app estimates
    const total = paragraphs.flat().length / 2.5;
    const elapsed = total * s.read;
    c.fillStyle = C.onSurfaceMuted;
    c.font = `600 12px "Roboto", sans-serif`;
    c.fillText(formatTime(elapsed), 17, ty + 18);
    c.textAlign = 'right';
    c.fillText(`-${formatTime(Math.max(0, total - elapsed))}`, UW - 17, ty + 18);
    c.textAlign = 'left';
    // Back 5 words / play-pause / forward 5 words
    const cy = UH - INSET - 10 - 28;
    [UW / 2 - 88, UW / 2 + 88].forEach((x, i) => {
      c.fillStyle = '#F1F5F9';
      c.beginPath();
      c.arc(x, cy, 24, 0, Math.PI * 2);
      c.fill();
      icon(c, i ? 'skipForward' : 'skipBack', x, cy, 24, C.onSurface);
    });
    const speaking = s.read > 0 && s.read < 1;
    elevation(c, 6);
    c.fillStyle = speaking ? C.primaryPressed : C.primary;
    c.beginPath();
    c.arc(UW / 2, cy, 28, 0, Math.PI * 2);
    c.fill();
    noShadow(c);
    if (speaking) icon(c, 'pause', UW / 2, cy, 30, '#FFFFFF', '#FFFFFF');
    else icon(c, 'play', UW / 2 + 3, cy, 30, '#FFFFFF', '#FFFFFF');
    navHandle();
  };

  const draw = (s: AppState, text: AppText, paragraphs: string[][]) => {
    c.setTransform(canvas.width / UW, 0, 0, canvas.height / UH, 0, 0);
    c.clearRect(0, 0, UW, UH);
    c.textAlign = 'left';
    // Camera fades to the blank app, then the reader fades in: never both at once
    if (s.reader <= 0) camera(s, text);
    else {
      c.fillStyle = C.bg;
      c.fillRect(0, 0, UW, UH);
      if (s.reader < 0.5) {
        c.globalAlpha = 1 - s.reader * 2;
        camera(s, text);
      } else {
        c.globalAlpha = s.reader * 2 - 1;
        reader(s, text, paragraphs);
      }
      c.globalAlpha = 1;
    }
  };

  /** Canvas pixels per dp. Matched to how big the screen gets on the page, so text stays crisp (a much
   * bigger canvas is shrunk on the GPU, which greys out thin letter strokes). */
  const setScale = (next: number) => {
    canvas.width = Math.round(UW * next);
    canvas.height = Math.round(UH * next);
  };

  return { canvas, draw, viewfinder, logoReady, setScale };
}
