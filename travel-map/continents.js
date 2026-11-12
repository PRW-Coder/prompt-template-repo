// ISO 3166-1 alpha-2 country code -> continent, used for the "Continents" count.
(function () {
  const groups = {
    'Africa': 'dz ao bj bw bf bi cv cm cf td km cg cd ci dj eg gq er sz et ga gm gh gn gw ke ls lr ly mg mw ml mr mu yt ma mz na ne ng re rw sh st sn sc sl so za ss sd tz tg tn ug eh zm zw',
    'Asia': 'af am az bh bd bt bn kh cn cy ge hk in id ir iq il jp jo kz kw kg la lb mo my mv mn mm np kp om pk ps ph qa sa sg kr lk sy tw tj th tl tr tm ae uz vn ye',
    'Europe': 'ax al ad at by be ba bg hr cz dk ee fo fi fr de gi gr gg hu is ie im it je xk lv li lt lu mt md mc me nl mk no pl pt ro ru sm rs sk si es sj se ch ua gb va',
    'North America': 'ai ag aw bs bb bz bm bq vg ca ky cr cu cw dm do sv gl gd gp gt ht hn jm mq mx ms ni pa pr bl kn lc mf pm vc sx tt tc us vi um',
    'South America': 'ar bo br cl co ec fk gf gy py pe sr uy ve',
    'Oceania': 'as au ck fj pf gu ki mh fm nr nc nz nu nf mp pw pg pn ws sb tk to tv vu wf',
    'Antarctica': 'aq bv tf hm gs',
  };
  const map = {};
  for (const [continent, codes] of Object.entries(groups)) {
    for (const code of codes.split(' ')) map[code] = continent;
  }
  window.CONTINENT_BY_CODE = map;
})();
