// Fondos del avatar (accesorio tipo fondo). Lienzo de 200×200.
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
    default: // tatami
      return (<>
        <rect width="200" height="200" fill="#163a6b" />
        <circle cx="100" cy="96" r="70" fill="#1f4c86" />
        <rect y="156" width="200" height="44" fill="#2f6b4f" />
        <path d="M0 156 H200 M66 156 V200 M134 156 V200 M0 178 H66 M134 178 H200" stroke="#255640" strokeWidth="3" />
      </>);
  }
}
