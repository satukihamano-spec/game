import type { PortraitExpression } from '../data/portraits';
import type { Gender } from '../data/speech';

// 顔画像（public/portraits/）が用意されていないときに使う「自動で描いた2Dの顔」（SVG）。
// 写真のような本物のリアルさは出せないので、画像を入れるまでの代わり。陰影のある、なるべく人間らしい顔にしている。
//   ・口は全表情で同じ形（閉じた口）に固定。口パクはしない
//   ・表情は「眉・目の開き・視線・ほおの上がり・汗・涙・眉間のしわ」で表す
//   ・まばたきと、緊張したときの視線の揺れだけ、軽いCSSアニメーションで動かす
//   ・肌の色・目の色・髪型・顔の幅は、顔IDから毎回同じものが選ばれる（同じ人は同じ顔）

export interface PortraitLook {
  id: string; // 顔ID（同じIDなら同じ顔）
  gender: Gender;
  clothes: number; // 服の色（マップ上の3Dモデルと同じ色）
  hair: number; // 髪の色
}

const SKINS = [
  { base: '#e9c2a0', light: '#f6dcc4', shade: '#c58f6c', lip: '#b46a62' },
  { base: '#deb08c', light: '#efcfb0', shade: '#b47b58', lip: '#a65c54' },
  { base: '#f0cdb2', light: '#fbe6d6', shade: '#cf9f80', lip: '#bd726c' },
  { base: '#c9966e', light: '#e0b892', shade: '#9a6646', lip: '#94524a' },
];
const EYES = ['#3b2618', '#5a3a22', '#2b2b2b', '#5e5038'];

// 表情ごとの顔の動き（眉の角度・高さ、目の開き、下まぶたの上がり、視線）
interface Face {
  browAngle: number; // ＋で眉間側が下がる（怒り）、−で眉間側が上がる（困り・悲しみ）
  browY: number; // ＋で下がる、−で上がる
  browAsym?: number; // 左右差（困惑：片方だけ上がる）
  open: number; // 目の開き（1 = 普通）
  lower: number; // 下まぶたの上がり（笑顔・警戒で上がる）
  gazeX: number;
  gazeY: number;
  iris: number; // 黒目の大きさ（驚きで小さく見える）
}
const FACES: Record<PortraitExpression, Face> = {
  neutral: { browAngle: 0, browY: 0, open: 1, lower: 0, gazeX: 0, gazeY: 0, iris: 1 },
  smile: { browAngle: -4, browY: -2, open: 0.78, lower: 0.42, gazeX: 0, gazeY: 0, iris: 1 },
  wary: { browAngle: 10, browY: 4, open: 0.6, lower: 0.18, gazeX: 5, gazeY: 0, iris: 1 },
  confused: { browAngle: -4, browY: -3, browAsym: 9, open: 0.95, lower: 0, gazeX: -4, gazeY: -2, iris: 1 },
  angry: { browAngle: 20, browY: 7, open: 0.78, lower: 0.15, gazeX: 0, gazeY: 0, iris: 1 },
  nervous: { browAngle: -14, browY: -4, open: 1.08, lower: 0, gazeX: 0, gazeY: 1, iris: 0.95 },
  surprised: { browAngle: -5, browY: -8, open: 1.35, lower: 0, gazeX: 0, gazeY: 0, iris: 0.82 },
  sad: { browAngle: -20, browY: -2, open: 0.62, lower: 0, gazeX: 0, gazeY: 4, iris: 1 },
};

let uid = 0;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

// 色を明るく（k>0）・暗く（k<0）する
function tone(c: number, k: number): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const f = (v: number): number => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return hex((f(r) << 16) | (f(g) << 8) | f(b));
}

// 顔を描いた SVG の文字列を返す
export function paintPortrait(look: PortraitLook, expr: PortraitExpression): string {
  const p = `pt${++uid}`; // この SVG の中だけで使う名前（同じ画面に2つ出しても混ざらないように）
  const h = hash(look.id);
  const skin = SKINS[h % SKINS.length];
  const eye = EYES[(h >> 3) % EYES.length];
  const style = (h >> 6) % 2; // 髪型（性別ごとに2種類）
  const fw = 0.94 + ((h >> 9) % 13) / 100; // 顔の幅
  const f = FACES[expr];
  const hairC = look.hair;
  const W = (x: number): number => 150 + (x - 150) * fw; // 顔の幅に合わせて横位置を広げる
  const female = look.gender === 'female';

  // ── 目（左右）──
  const eyeSvg = (cx: number, side: 1 | -1): string => {
    const ex = W(cx);
    const ey = 152;
    const upper = 10 * f.open;
    const lower = 7 * (1 - f.lower);
    const shape = `M${ex - 18},${ey} C${ex - 9},${ey - upper} ${ex + 9},${ey - upper} ${ex + 18},${ey} C${ex + 9},${ey + lower} ${ex - 9},${ey + lower} ${ex - 18},${ey} Z`;
    const ix = ex + f.gazeX;
    const iy = ey + f.gazeY + (1 - f.open) * 1.5;
    const r = 8.6 * f.iris;
    const id = `${p}e${side}`;
    return `
      <clipPath id="${id}"><path d="${shape}"/></clipPath>
      <path d="${shape}" fill="#f3ece6"/>
      <g clip-path="url(#${id})">
        <path d="M${ex - 18},${ey - 1} C${ex - 9},${ey - upper - 1} ${ex + 9},${ey - upper - 1} ${ex + 18},${ey - 1}" stroke="${skin.shade}" stroke-width="5" fill="none" opacity="0.35"/>
        <g class="pt-iris${expr === 'nervous' ? ' pt-dart' : ''}">
          <circle cx="${ix}" cy="${iy}" r="${r}" fill="url(#${p}iris)"/>
          <circle cx="${ix}" cy="${iy}" r="${r * 0.42}" fill="#0b0807"/>
          <circle cx="${ix - r * 0.32}" cy="${iy - r * 0.36}" r="${r * 0.22}" fill="#fff" opacity="0.9"/>
          <circle cx="${ix + r * 0.35}" cy="${iy + r * 0.3}" r="${r * 0.1}" fill="#fff" opacity="0.6"/>
        </g>
        <rect class="pt-lid" x="${ex - 20}" y="${ey - 14}" width="40" height="28" fill="${skin.base}"/>
      </g>
      <path d="M${ex - 19},${ey + 0.5} C${ex - 9},${ey - upper - 0.5} ${ex + 9},${ey - upper - 0.5} ${ex + 19},${ey - 0.5}" stroke="#2a1c16" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M${ex + side * -19},${ey + 0.5} l${side * -4},${-3}" stroke="#2a1c16" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M${ex - 14},${ey + lower * 0.85} C${ex - 6},${ey + lower + 1} ${ex + 6},${ey + lower + 1} ${ex + 14},${ey + lower * 0.85}" stroke="${skin.shade}" stroke-width="1.2" fill="none" opacity="0.7"/>
      <path d="M${ex - 15},${ey - upper - 6} C${ex - 6},${ey - upper - 10} ${ex + 7},${ey - upper - 10} ${ex + 15},${ey - upper - 5}" stroke="${skin.shade}" stroke-width="1.4" fill="none" opacity="0.5"/>`;
  };

  // ── 眉（左右）。眉間側の端が x=+20（左の眉）。右の眉は左右反転 ──
  const brow = (cx: number, side: 1 | -1): string => {
    const asym = f.browAsym ? (side === 1 ? -f.browAsym : f.browAsym * 0.3) : 0;
    const y = 122 + f.browY + asym;
    const shape = 'M-22,4 C-12,-5 6,-6 20,-2 L20,3 C6,0 -10,1 -22,8 Z';
    const ang = f.browAngle + (f.browAsym ? (side === 1 ? -6 : 4) : 0);
    return `<path d="${shape}" fill="${tone(hairC, -0.25)}" transform="translate(${W(cx)},${y}) scale(${side},1) rotate(${ang})"/>`;
  };

  // ── 髪（後ろ・前）──
  const hairBack = female
    ? style === 0
      ? `<path d="M${W(70)},150 C${W(64)},70 ${W(105)},34 150,34 C${W(195)},34 ${W(236)},70 ${W(230)},150 C${W(234)},215 ${W(240)},262 ${W(228)},300 L${W(72)},300 C${W(60)},262 ${W(66)},215 ${W(70)},150 Z" fill="url(#${p}hair)"/>`
      : `<path d="M${W(72)},150 C${W(66)},72 ${W(106)},36 150,36 C${W(194)},36 ${W(234)},72 ${W(228)},150 C${W(232)},190 ${W(230)},222 ${W(222)},236 L${W(78)},236 C${W(70)},222 ${W(68)},190 ${W(72)},150 Z" fill="url(#${p}hair)"/>`
    : '';
  const hairFront = female
    ? `<path d="M${W(74)},158 C${W(68)},78 ${W(108)},40 150,40 C${W(194)},40 ${W(232)},78 ${W(226)},158 C${W(218)},128 ${W(206)},104 ${W(186)},94 C${W(170)},112 ${W(140)},116 ${W(112)},104 C${W(96)},118 ${W(82)},134 ${W(74)},158 Z" fill="url(#${p}hair)"/>
       <path d="M${W(186)},94 C${W(176)},104 ${W(160)},110 ${W(150)},111" stroke="${tone(hairC, 0.25)}" stroke-width="2" fill="none" opacity="0.5"/>`
    : style === 0
      ? `<path d="M${W(76)},146 C${W(70)},74 ${W(108)},40 150,40 C${W(196)},40 ${W(232)},74 ${W(224)},146 C${W(218)},116 ${W(206)},98 ${W(190)},90 C${W(166)},100 ${W(130)},102 ${W(104)},92 C${W(90)},106 ${W(80)},124 ${W(76)},146 Z" fill="url(#${p}hair)"/>`
      : `<path d="M${W(76)},150 C${W(68)},76 ${W(106)},38 152,38 C${W(198)},38 ${W(234)},76 ${W(224)},150 C${W(220)},120 ${W(212)},102 ${W(198)},94 C${W(176)},92 ${W(150)},100 ${W(126)},112 C${W(110)},116 ${W(92)},124 ${W(76)},150 Z" fill="url(#${p}hair)"/>
         <path d="M${W(198)},94 C${W(176)},94 ${W(150)},102 ${W(128)},112" stroke="${tone(hairC, 0.3)}" stroke-width="2" fill="none" opacity="0.45"/>`;

  // ── 表情の追加の印（汗・涙・眉間のしわ・ほおの赤み）──
  let extra = '';
  if (expr === 'angry') {
    extra += `<path d="M146,126 l-2,12 M154,126 l2,12" stroke="${skin.shade}" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/>`;
    extra += `<path d="M138,166 C144,170 156,170 162,166" stroke="${skin.shade}" stroke-width="1.2" fill="none" opacity="0.35"/>`;
  }
  if (expr === 'nervous') {
    extra += `<path d="M${W(206)},106 C${W(212)},118 ${W(214)},124 ${W(208)},128 C${W(202)},124 ${W(202)},118 ${W(206)},106 Z" fill="url(#${p}drop)" opacity="0.85"/>`;
  }
  if (expr === 'sad') {
    extra += `<path d="M${W(178) + 4},162 C${W(178) + 8},176 ${W(178) + 7},188 ${W(178) + 3},194 C${W(178) - 1},186 ${W(178)},174 ${W(178) + 4},162 Z" fill="url(#${p}drop)" opacity="0.75"/>`;
  }
  if (expr === 'surprised') {
    extra += `<path d="M${W(118)},92 C140,88 160,88 ${W(182)},92 M${W(124)},100 C142,97 158,97 ${W(176)},100" stroke="${skin.shade}" stroke-width="1" fill="none" opacity="0.35"/>`;
  }
  const blush = expr === 'smile' ? 0.35 : expr === 'nervous' || expr === 'angry' ? 0.22 : 0.12;
  const cheekY = expr === 'smile' ? 180 : 186;

  return `<svg class="pt-svg" viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMin slice">
  <defs>
    <radialGradient id="${p}skin" cx="45%" cy="38%" r="70%">
      <stop offset="0" stop-color="${skin.light}"/><stop offset="0.55" stop-color="${skin.base}"/><stop offset="1" stop-color="${skin.shade}"/>
    </radialGradient>
    <linearGradient id="${p}neck" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${skin.shade}"/><stop offset="0.5" stop-color="${skin.base}"/>
    </linearGradient>
    <linearGradient id="${p}hair" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${tone(hairC, 0.28)}"/><stop offset="0.45" stop-color="${hex(hairC)}"/><stop offset="1" stop-color="${tone(hairC, -0.45)}"/>
    </linearGradient>
    <linearGradient id="${p}cloth" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tone(look.clothes, 0.18)}"/><stop offset="1" stop-color="${tone(look.clothes, -0.4)}"/>
    </linearGradient>
    <radialGradient id="${p}iris" cx="50%" cy="45%" r="55%">
      <stop offset="0" stop-color="${eye}"/><stop offset="0.75" stop-color="${eye}"/><stop offset="1" stop-color="#140c08"/>
    </radialGradient>
    <radialGradient id="${p}drop" cx="40%" cy="40%" r="70%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9cc8e6"/>
    </radialGradient>
    <linearGradient id="${p}lip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${skin.lip}"/><stop offset="1" stop-color="${tone(parseInt(skin.lip.slice(1), 16), 0.12)}"/>
    </linearGradient>
  </defs>
  <g class="pt-body">
    ${hairBack}
    <path d="M0,400 L0,352 C14,306 66,290 112,282 L128,270 L172,270 L188,282 C234,290 286,306 300,352 L300,400 Z" fill="url(#${p}cloth)"/>
    <path d="M128,270 L150,318 L172,270" fill="none" stroke="${tone(look.clothes, -0.55)}" stroke-width="3" opacity="0.6"/>
    <path d="M${W(127)},212 L${W(127)},282 C140,296 160,296 ${W(173)},282 L${W(173)},212 Z" fill="url(#${p}neck)"/>
    <ellipse cx="${W(76)}" cy="158" rx="9" ry="19" fill="${skin.base}"/>
    <ellipse cx="${W(224)}" cy="158" rx="9" ry="19" fill="${skin.base}"/>
    <path d="M150,54 C${W(204)},54 ${W(224)},96 ${W(224)},142 C${W(224)},188 ${W(204)},226 150,244 C${W(96)},226 ${W(76)},188 ${W(76)},142 C${W(76)},96 ${W(96)},54 150,54 Z" fill="url(#${p}skin)"/>
    <ellipse cx="${W(116)}" cy="${cheekY}" rx="17" ry="10" fill="#e8807a" opacity="${blush}"/>
    <ellipse cx="${W(184)}" cy="${cheekY}" rx="17" ry="10" fill="#e8807a" opacity="${blush}"/>
    <path d="M${W(104)},200 C120,236 180,236 ${W(196)},200" stroke="${skin.shade}" stroke-width="6" fill="none" opacity="0.18"/>
    ${eyeSvg(122, 1)}
    ${eyeSvg(178, -1)}
    ${brow(122, 1)}
    ${brow(178, -1)}
    <path d="M146,158 C145,172 143,184 142,193" stroke="${skin.shade}" stroke-width="3" fill="none" opacity="0.22" stroke-linecap="round"/>
    <path d="M139,197 C144,203 156,203 161,197" stroke="${skin.shade}" stroke-width="2" fill="none" opacity="0.55" stroke-linecap="round"/>
    <ellipse cx="143" cy="198" rx="3" ry="1.8" fill="#5a3428" opacity="0.45"/>
    <ellipse cx="157" cy="198" rx="3" ry="1.8" fill="#5a3428" opacity="0.45"/>
    <ellipse cx="151" cy="190" rx="4" ry="3" fill="#fff" opacity="0.18"/>
    <path d="M130,216 C139,211 146,212 150,214 C154,212 161,211 170,216 C160,219 140,219 130,216 Z" fill="url(#${p}lip)"/>
    <path d="M132,217 C140,226 160,226 168,217 C160,220 140,220 132,217 Z" fill="${skin.lip}" opacity="0.85"/>
    <path d="M130,216 C140,218.5 160,218.5 170,216" stroke="#6a3a34" stroke-width="1.2" fill="none" opacity="0.8"/>
    <ellipse cx="152" cy="222" rx="7" ry="1.6" fill="#fff" opacity="0.22"/>
    ${extra}
    ${hairFront}
  </g>
</svg>`;
}
