// @ts-nocheck
export const globalHead = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&amp;family=Hanken+Grotesk:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css">
<script src="./image-slot.js"></script>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%);background-attachment:fixed;color:#241f1c;font-family:'Hanken Grotesk',system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  a{color:#d95d1e;text-decoration:none}
  a:hover{color:#bd4d16}
  ::selection{background:#f8a800;color:#241f1c}
  button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
  input,select,textarea{font-family:inherit}
  [data-scroll]::-webkit-scrollbar{width:11px;height:11px}
  [data-scroll]::-webkit-scrollbar-thumb{background:#d8d1c1;border-radius:9px;border:3px solid transparent;background-clip:content-box}
  [data-scroll]::-webkit-scrollbar-track{background:transparent}
  image-slot{--radius:14px}
  @keyframes omRise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  @keyframes omSlide{from{opacity:0;transform:translateX(34px)}to{opacity:1;transform:none}}
  @keyframes omPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
  @keyframes omVeil{from{opacity:0}to{opacity:1}}
  @keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes omGlow{0%,100%{box-shadow:0 0 0 0 rgba(240,168,60,.45)}50%{box-shadow:0 0 0 10px rgba(240,168,60,0)}}
  @keyframes dashDraw{from{stroke-dashoffset:440}}
  @keyframes moneyWash{from{opacity:0}to{opacity:1}}
  @keyframes moneyHalo{0%,100%{transform:scale(1);opacity:.42}50%{transform:scale(1.3);opacity:.12}}
  @keyframes moneyRise{0%{transform:translateY(10vh) rotate(-6deg);opacity:0}14%{opacity:.85}100%{transform:translateY(-115vh) rotate(18deg);opacity:0}}
  @keyframes stampIn{0%{transform:scale(2.5) rotate(-16deg);opacity:0}62%{transform:scale(.95) rotate(-7deg);opacity:1}100%{transform:scale(1) rotate(-7deg);opacity:1}}
  @keyframes moneyUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
  @keyframes noteFloat{0%{transform:translateY(30%) rotate(-10deg);opacity:0}14%{opacity:.55}100%{transform:translateY(-320%) rotate(16deg);opacity:0}}
  @keyframes moneyShine{0%{transform:translateX(-140%) skewX(-18deg)}55%,100%{transform:translateX(150%) skewX(-18deg)}}
  @keyframes coinPop{from{transform:scale(.84) translateY(10px);opacity:0}to{transform:none;opacity:1}}
  @keyframes coinShimmer{0%,100%{box-shadow:inset 0 2px 0 rgba(255,255,255,.7),inset 0 -6px 12px rgba(140,90,0,.45),0 12px 26px -12px rgba(0,0,0,.6)}50%{box-shadow:inset 0 2px 0 rgba(255,255,255,.95),inset 0 -6px 12px rgba(140,90,0,.35),0 16px 32px -12px rgba(0,0,0,.55)}}
</style>
`;

export function renderApp(state: any) {
  const compiler = new Function('props', `
    with (props) {
      return \`${content}\`;
    }
  `);
  
  return compiler(state);
}
