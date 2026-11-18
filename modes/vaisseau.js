// =====================================================================
//  LE VAISSEAU : FOND ÉTOILÉ VIVANT ET SAUT HYPERESPACE
//  1. Sur l'accueil et dans le salon, un champ d'étoiles défile lentement en profondeur ;
//     de temps en temps passe une étoile filante, ou un vaisseau au loin.
//     (Dans le salon, les étoiles sont dessinées à l'intérieur du cadre, derrière son contenu.)
//     Le fond s'arrête pendant les parties, pour ne pas ralentir les jeux.
//  2. Quand on passe du salon à un jeu : saut hyperespace d'une demi-seconde
//     (les étoiles s'étirent en traînées, éclair, son « warp »).
//  Si l'appareil demande des animations réduites, le fond reste immobile et le saut est un simple fondu.
// =====================================================================
(function () {
    const calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ECRANS_FOND = ['screen-home', 'screen-lobby'];
    const alea = (a, b) => a + Math.random() * (b - a);

    // ---------------- 1. Fond étoilé ----------------
    const fond = document.createElement('canvas');
    fond.id = 'vaisseau-fond';
    fond.setAttribute('aria-hidden', 'true');
    const cx = fond.getContext('2d');
    let L = 0, H = 0, dpr = 1, actif = false, raf = 0, avant = 0, verif = 0;
    const etoiles = [];
    const NB = 260;
    const nouvelleEtoile = (loin) => ({ x: alea(-1, 1), y: alea(-1, 1), z: loin ? alea(0.6, 1) : alea(0.05, 1),
        teinte: Math.random() < 0.12 ? (Math.random() < 0.5 ? '186,230,253' : '253,230,138') : '226,232,240', scint: alea(0, 6.3) });
    for (let i = 0; i < NB; i++) etoiles.push(nouvelleEtoile(false));
    let filantes = [], vaisseaux = [];
    let prochaineFilante = performance.now() + alea(3000, 7000), prochainVaisseau = performance.now() + alea(9000, 16000);

    function placer() {
        // dans le salon : à l'intérieur du cadre (derrière son contenu) ; sur l'accueil : derrière toute la page
        const salon = document.getElementById('screen-lobby');
        const dansSalon = salon && !salon.classList.contains('hidden') && salon.style.display !== 'none';
        const parent = dansSalon ? salon : document.body;
        if (fond.parentNode !== parent) parent.insertBefore(fond, parent.firstChild);
        fond.style.cssText = (dansSalon ? 'position:absolute;inset:0;border-radius:inherit;' : 'position:fixed;inset:0;') +
            'width:100%;height:100%;z-index:-1;pointer-events:none;display:block';
        taille();
    }
    function taille() {
        const r = fond.getBoundingClientRect();
        dpr = Math.min(1.5, window.devicePixelRatio || 1);
        L = Math.max(1, r.width); H = Math.max(1, r.height);
        fond.width = Math.round(L * dpr); fond.height = Math.round(H * dpr);
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', () => { if (actif) taille(); });

    function dessinerVaisseau(v) {
        cx.save();
        cx.translate(v.x, v.y); cx.scale(v.s * v.sens, v.s); cx.rotate(v.angle);
        // traînée du réacteur
        const g = cx.createLinearGradient(-60, 0, -8, 0);
        g.addColorStop(0, 'rgba(56,189,248,0)'); g.addColorStop(1, 'rgba(125,211,252,.8)');
        cx.fillStyle = g; cx.fillRect(-60, -1.6, 52, 3.2);
        // coque
        cx.fillStyle = 'rgba(148,163,184,.85)';
        cx.beginPath(); cx.moveTo(14, 0); cx.lineTo(-6, -4); cx.lineTo(-10, -9); cx.lineTo(-8, -3); cx.lineTo(-10, 0); cx.lineTo(-8, 3); cx.lineTo(-10, 9); cx.lineTo(-6, 4); cx.closePath(); cx.fill();
        cx.fillStyle = 'rgba(15,23,42,.9)'; cx.fillRect(-2, -1.2, 8, 2.4);
        // feu clignotant
        if (Math.sin(v.t * 6) > 0.4) { cx.fillStyle = 'rgba(248,113,113,1)'; cx.beginPath(); cx.arc(-9, -8, 1.2, 0, 6.3); cx.fill(); }
        cx.restore();
    }

    function image(maintenant) {
        if (!actif) return;
        raf = requestAnimationFrame(image);
        if (document.hidden) return;
        // sécurité : si l'écran a changé sans passer par showScreen, on se replace ou on s'arrête
        if (++verif % 60 === 0) {
            const vu = ecranVisible();
            if (vu && ECRANS_FOND.indexOf(vu) < 0) { ecranActuel = vu; arreter(); return; }
            if (vu === 'screen-lobby' && fond.parentNode === document.body) placer();
            if (vu === 'screen-home' && fond.parentNode !== document.body) placer();
        }
        const dt = Math.min(0.05, (maintenant - (avant || maintenant)) / 1000); avant = maintenant;
        cx.clearRect(0, 0, L, H);
        // nébuleuse discrète
        const n = cx.createRadialGradient(L * 0.72, H * 0.3, 0, L * 0.72, H * 0.3, Math.max(L, H) * 0.6);
        n.addColorStop(0, 'rgba(76,29,149,.16)'); n.addColorStop(0.5, 'rgba(14,116,144,.07)'); n.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = n; cx.fillRect(0, 0, L, H);
        // étoiles qui viennent lentement vers nous
        const vitesse = calme ? 0 : 0.018, f = Math.min(L, H) * 0.9, ox = L / 2, oy = H / 2;
        for (const e of etoiles) {
            e.z -= vitesse * dt;
            if (e.z <= 0.04) Object.assign(e, nouvelleEtoile(true));
            const px = ox + e.x / e.z * f * 0.5, py = oy + e.y / e.z * f * 0.5;
            if (px < -5 || px > L + 5 || py < -5 || py > H + 5) { Object.assign(e, nouvelleEtoile(true)); continue; }
            const proche = 1 - e.z, r = 0.35 + proche * 1.5;
            const lum = Math.min(1, 0.25 + proche * 0.9) * (0.8 + 0.2 * Math.sin(maintenant / 600 + e.scint));
            cx.fillStyle = `rgba(${e.teinte},${lum.toFixed(3)})`;
            cx.beginPath(); cx.arc(px, py, r, 0, 6.3); cx.fill();
        }
        if (!calme) {
            // étoile filante de temps en temps
            if (maintenant > prochaineFilante) {
                prochaineFilante = maintenant + alea(5000, 12000);
                const gauche = Math.random() < 0.5, a = alea(0.35, 0.7);
                filantes.push({ x: gauche ? alea(0, L * 0.5) : alea(L * 0.5, L), y: alea(0, H * 0.35), vx: Math.cos(a) * (gauche ? 1 : -1) * alea(700, 1000), vy: Math.sin(a) * alea(700, 1000), vie: 0, max: alea(0.6, 0.9) });
            }
            filantes = filantes.filter(s => {
                s.vie += dt; if (s.vie > s.max) return false;
                s.x += s.vx * dt; s.y += s.vy * dt;
                const k = 1 - s.vie / s.max, lg = 0.09;
                const g = cx.createLinearGradient(s.x, s.y, s.x - s.vx * lg, s.y - s.vy * lg);
                g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
                cx.strokeStyle = g; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(s.x - s.vx * lg, s.y - s.vy * lg); cx.stroke();
                return true;
            });
            // vaisseau qui passe au loin, plus rarement
            if (maintenant > prochainVaisseau) {
                prochainVaisseau = maintenant + alea(18000, 35000);
                const sens = Math.random() < 0.5 ? 1 : -1, s = alea(0.55, 1.1);
                vaisseaux.push({ x: sens > 0 ? -80 : L + 80, y: alea(H * 0.12, H * 0.75), vx: sens * alea(45, 90) * s, sens: sens, s: s, angle: alea(-0.08, 0.08), t: 0 });
            }
            vaisseaux = vaisseaux.filter(v => { v.t += dt; v.x += v.vx * dt; v.y += Math.sin(v.t * 0.7) * 0.15; dessinerVaisseau(v); return v.x > -120 && v.x < L + 120; });
        }
    }

    function demarrer() { if (actif) { placer(); return; } actif = true; avant = 0; placer(); raf = requestAnimationFrame(image); }
    function arreter() { actif = false; cancelAnimationFrame(raf); if (fond.parentNode) fond.parentNode.removeChild(fond); }

    // ---------------- 2. Saut hyperespace ----------------
    let enSaut = false;
    function sautHyperespace() {
        if (enSaut) return; enSaut = true;
        if (typeof window.sfx === 'function') { try { window.sfx('warp'); } catch (e) {} }
        const ov = document.createElement('canvas');
        ov.setAttribute('aria-hidden', 'true');
        ov.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:10100;pointer-events:none;opacity:0;transition:opacity .08s';
        document.body.appendChild(ov);
        const w = window.innerWidth, h = window.innerHeight, r = Math.min(1.5, window.devicePixelRatio || 1);
        ov.width = Math.round(w * r); ov.height = Math.round(h * r);
        const c = ov.getContext('2d'); c.setTransform(r, 0, 0, r, 0, 0);
        const traits = Array.from({ length: calme ? 0 : 320 }, () => ({ a: alea(0, 6.3), d: alea(0.02, 0.5), v: alea(0.8, 1.6), teinte: Math.random() < 0.3 ? '125,211,252' : '255,255,255' }));
        const DUREE = calme ? 350 : 620, debut = performance.now(), m = Math.hypot(w, h) / 2;
        requestAnimationFrame(() => { ov.style.opacity = '1'; });
        const pas = maintenant => {
            const p = Math.min(1, (maintenant - debut) / DUREE);
            c.fillStyle = `rgba(2,6,23,${calme ? 0.9 : 0.55 + 0.4 * Math.min(1, p * 3)})`; c.fillRect(0, 0, w, h);
            const acc = p * p * 3.2;                       // les étoiles accélèrent : points, puis longues traînées
            for (const t of traits) {
                const d0 = t.d + acc * t.v * 0.55, d1 = d0 + 0.01 + acc * t.v * 0.35;
                const x0 = w / 2 + Math.cos(t.a) * d0 * m, y0 = h / 2 + Math.sin(t.a) * d0 * m;
                const x1 = w / 2 + Math.cos(t.a) * d1 * m, y1 = h / 2 + Math.sin(t.a) * d1 * m;
                c.strokeStyle = `rgba(${t.teinte},${Math.min(1, 0.3 + p)})`; c.lineWidth = 0.8 + p * 2.2;
                c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
            }
            // lueur bleue au centre, puis éclair blanc à la sortie du saut
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, m * (0.15 + p * 0.5));
            g.addColorStop(0, `rgba(186,230,253,${0.5 * p})`); g.addColorStop(1, 'rgba(56,189,248,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
            if (p > 0.82) { c.fillStyle = `rgba(255,255,255,${(p - 0.82) / 0.18 * 0.85})`; c.fillRect(0, 0, w, h); }
            if (p < 1) requestAnimationFrame(pas);
            else {
                ov.style.transition = 'opacity .3s ease-out'; ov.style.opacity = '0';
                setTimeout(() => { ov.remove(); enSaut = false; }, 320);
            }
        };
        requestAnimationFrame(pas);
    }
    window.sautHyperespace = sautHyperespace;
    // pour tester : fait passer tout de suite une étoile filante et un vaisseau
    window.vaisseauDemo = () => { prochaineFilante = 0; prochainVaisseau = 0; };

    // ---------------- Branchement sur le changement d'écran ----------------
    function ecranVisible() {
        return ['screen-home', 'screen-lobby'].concat(Array.from(document.querySelectorAll('[id^="screen-"]')).map(e => e.id))
            .find(id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden') && e.style.display !== 'none' && e.offsetParent !== null; }) || '';
    }
    let ecranActuel = '';
    function surChangement(cible) {
        const precedent = ecranActuel; ecranActuel = cible;
        if (precedent === 'screen-lobby' && cible && ECRANS_FOND.indexOf(cible) < 0) sautHyperespace();   // du salon vers un jeu
        if (ECRANS_FOND.indexOf(cible) >= 0) demarrer(); else arreter();
    }
    function brancher() {
        if (typeof window.showScreen === 'function' && !window.showScreen._vaisseau) {
            const original = window.showScreen;
            const enveloppe = function (id) { const r = original.apply(this, arguments); try { surChangement(id); } catch (e) {} return r; };
            enveloppe._vaisseau = true;
            window.showScreen = enveloppe;
        }
        surChangement(ecranVisible() || 'screen-home');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher); else brancher();
})();
