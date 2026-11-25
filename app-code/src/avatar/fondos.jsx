// Fondos del avatar (accesorio tipo fondo). Mismo lienzo de 200×200; el suelo del avatar está en y = 186.
export function Fondo({ clave, id }) {
  switch (clave) {
    case 'fondo-atardecer':
      return (<>
        <defs><linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6f91" /><stop offset=".6" stopColor="#ffa45b" /><stop offset="1" stopColor="#ffd36b" /></linearGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}a)`} />
        <circle cx="100" cy="132" r="58" fill="#fff2b3" opacity=".55" />
        <path d="M0 160 Q50 145 100 158 T200 152 V200 H0Z" fill="#7a3a52" opacity=".55" />
      </>);
    case 'fondo-montana':
      return (<>
        <defs><linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4ea3ff" /><stop offset="1" stopColor="#c6e6ff" /></linearGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}m)`} />
        <path d="M-10 170 L55 80 L95 135 L135 70 L210 170Z" fill="#35588f" />
        <path d="M55 80 L67 96 L58 93 L50 100 L45 94Z M135 70 L149 89 L139 86 L130 94 L124 86Z" fill="#fff" />
        <path d="M-10 175 Q100 150 210 175 V200 H-10Z" fill="#2b4d3f" />
      </>);
    case 'fondo-estrellas':
      return (<>
        <defs><linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#140a3a" /><stop offset="1" stopColor="#3d2a86" /></linearGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}e)`} />
        {[[20, 25], [48, 60], [160, 30], [178, 78], [30, 120], [170, 132], [120, 18], [72, 22], [186, 175], [12, 180]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.6} fill="#fff" opacity={i % 2 ? .7 : 1} />)}
        <circle cx="158" cy="44" r="14" fill="#ffe9a8" /><circle cx="164" cy="39" r="12" fill="#2a1c62" />
      </>);
    case 'fondo-dragon':
      return (<>
        <defs><radialGradient id={`${id}d`} cx=".5" cy=".7" r=".8"><stop offset="0" stopColor="#ff8a3d" /><stop offset=".5" stopColor="#b3202a" /><stop offset="1" stopColor="#3b0a10" /></radialGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}d)`} />
        <path d="M14 150 C20 90 70 70 60 30 C90 60 100 30 96 8 C130 40 150 30 150 6 C180 50 186 100 186 150Z" fill="#ffb44d" opacity=".25" />
        <path d="M20 60 C60 20 110 70 150 40 C170 28 182 32 192 44" fill="none" stroke="#f2b705" strokeWidth="5" strokeLinecap="round" opacity=".8" />
        <circle cx="188" cy="42" r="4" fill="#f2b705" />
      </>);
    default: // dojo: pared de madera, pergamino y tatami
      return (<>
        <defs><linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2118" /><stop offset="1" stopColor="#3d2f22" /></linearGradient></defs>
        <rect width="200" height="200" fill={`url(#${id}t)`} />
        {[18, 52, 86, 120, 154, 188].map((x) => <rect key={x} x={x} y="0" width="3" height="150" fill="#000" opacity=".22" />)}
        <rect x="0" y="22" width="200" height="4" fill="#000" opacity=".25" />
        <rect x="130" y="34" width="38" height="84" rx="2" fill="#e9e1cc" />
        <rect x="128" y="32" width="42" height="5" rx="2" fill="#5a3b22" /><rect x="128" y="116" width="42" height="5" rx="2" fill="#5a3b22" />
        <circle cx="149" cy="70" r="12" fill="none" stroke="#1d1a17" strokeWidth="4" strokeDasharray="62 14" strokeLinecap="round" />
        <rect y="150" width="200" height="50" fill="#8c8a55" />
        <path d="M0 150 H200 M0 174 H200 M66 150 V200 M134 150 V200" stroke="#6d6b3f" strokeWidth="2.5" />
        <rect y="148" width="200" height="4" fill="#1f1810" opacity=".6" />
      </>);
  }
}
