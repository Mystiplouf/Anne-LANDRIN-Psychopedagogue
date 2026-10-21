/* Navigation commune : ouverture au clic, focus dans le volet, fermeture au clavier et restitution du défilement. */
(() => {
  const root = document.getElementById('al-lumiere-v2');
  const content = root.querySelector('.al-page-content');
  const opener = root.querySelector('#al-v2-open');
  const closer = root.querySelector('#al-v2-close');
  const drawer = root.querySelector('#al-v2-menu');
  const shade = root.querySelector('#al-v2-shade');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  /* ✏️ MODIFIABLE : durées et courbes de l'ouverture, de la fermeture et du voile. */
  const menuMotion = { open:560, close:400, shadeOpen:380, shadeClose:320, easing:'cubic-bezier(.22,.72,.22,1)' };
  let previousOverflow = null, menuOpen = false, menuRevision = 0;
  let menuAnimations = [];
  let hideCursorLens = () => {};
  const cancelMenuAnimations = () => {
    menuAnimations.forEach(animation => animation.cancel());
    menuAnimations = [];
  };
  /* La page ne redevient interactive qu'une fois le volet complètement refermé. */
  const finishMenu = (open, restoreFocus) => {
    drawer.hidden = shade.hidden = !open;
    content.inert = open;
    cancelMenuAnimations();
    drawer.style.willChange = shade.style.willChange = '';
    if (!open) {
      if (previousOverflow) {
        [document.documentElement.style.overflow, document.body.style.overflow] = previousOverflow;
        previousOverflow = null;
      }
      if (restoreFocus) opener.focus({preventScroll:true});
    }
  };
  /* Une interruption repart de la position visible, sans saut ni finalisation d'un ancien mouvement. */
  const setMenu = (open, {immediate=false, restoreFocus=true} = {}) => {
    if (open === menuOpen && !immediate) return;
    const fromDrawer = drawer.hidden ? {transform:'translate3d(100%,0,0)',opacity:.85} : {transform:getComputedStyle(drawer).transform,opacity:getComputedStyle(drawer).opacity};
    const fromShade = shade.hidden ? 0 : getComputedStyle(shade).opacity;
    const revision = ++menuRevision;
    menuOpen = open;
    cancelMenuAnimations();
    opener.setAttribute('aria-expanded', String(open));
    if (open) {
      hideCursorLens();
      if (!previousOverflow) {
        previousOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
        document.documentElement.style.overflow = document.body.style.overflow = 'hidden';
      }
      drawer.hidden = shade.hidden = false;
      content.inert = true;
      closer.focus({preventScroll:true});
    }
    if (immediate || reducedMotion.matches) {
      finishMenu(open, restoreFocus);
      return;
    }
    drawer.style.willChange = 'transform, opacity';
    shade.style.willChange = 'opacity';
    const panel = drawer.animate([fromDrawer, {transform:open ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',opacity:open ? 1 : .85}], {duration:open ? menuMotion.open : menuMotion.close,easing:open ? menuMotion.easing : 'cubic-bezier(.4,0,.2,1)',fill:'both'});
    const veil = shade.animate([{opacity:fromShade},{opacity:open ? 1 : 0}], {duration:open ? menuMotion.shadeOpen : menuMotion.shadeClose,easing:'ease-in-out',fill:'both'});
    menuAnimations = [panel, veil];
    Promise.all(menuAnimations.map(animation => animation.finished)).then(() => {
      if (revision === menuRevision) finishMenu(open, restoreFocus);
    }).catch(() => { /* Une annulation est normale lorsqu'un mouvement est interrompu. */ });
  };
  opener.addEventListener('click', () => setMenu(true));
  closer.addEventListener('click', () => setMenu(false));
  shade.addEventListener('click', () => setMenu(false));
  /* La navigation entre pages reste immédiate ; elle libère aussi la page enregistrée dans l'historique. */
  drawer.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false, {immediate:true,restoreFocus:false})));
  document.addEventListener('keydown', event => {
    if (drawer.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); return; }
    if (event.key !== 'Tab') return;
    const targets = [...drawer.querySelectorAll('a[href],button:not([disabled])')];
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
  });
  window.addEventListener('pagehide', () => setMenu(false, {immediate:true,restoreFocus:false}));

  /* Transition de l'accueil : disques du logo, joués une fois à l'arrivée dans la zone. */
  const transition = root.querySelector('.al-transition');
  let animations = [];
  if (transition) {
    let played = false;
    const play = announce => {
      animations.forEach(animation => animation.cancel());
      animations = [];
      played = true;
      if (!reducedMotion.matches) {
        root.querySelectorAll('.al-disc').forEach((disc,index) => animations.push(disc.animate([{transform:'translateY(75px) scale(.18)'},{transform:'translateY(0) scale(1)'}],{duration:1200,delay:[45,0,110,70,20,130,65,100][index],easing:'cubic-bezier(.22,.75,.22,1)',fill:'backwards'})));
        root.querySelectorAll('.al-outline').forEach((ring,index) => animations.push(ring.animate([{transform:'translateY(30px) scale(.55)',opacity:0},{transform:'translateY(0) scale(1)',opacity:.64}],{duration:1200,delay:150+index*70,easing:'cubic-bezier(.22,.75,.22,1)',fill:'backwards'})));
      }
      if (announce) root.querySelector('#al-v2-status').textContent = reducedMotion.matches ? 'Transition statique : réduction des mouvements activée.' : 'Transition circulaire rejouée.';
    };
    root.querySelector('#al-v2-replay')?.addEventListener('click', () => {transition.scrollIntoView({block:'center',behavior:'instant'});play(true);});
    if ('IntersectionObserver' in window) {
      let wasOutside = false;
      new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) wasOutside = true;
        if (entry.isIntersecting && wasOutside && !played) play(false);
      }),{threshold:.35}).observe(transition);
    }
    window.addEventListener('scroll', () => {
      if (played || !drawer.hidden) return;
      const rect = transition.getBoundingClientRect();
      if (rect.top < innerHeight*.92 && rect.bottom > 0) play(false);
    },{passive:true});
  }
  /* Réduction des mouvements : terminer immédiatement l'état demandé et libérer les interactions si nécessaire. */
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      animations.forEach(animation => animation.cancel());
      if (menuAnimations.length) {
        ++menuRevision;
        finishMenu(menuOpen, true);
      }
    }
  });

  /* Lentille décorative : une seule section visible est reproduite, jamais la page entière.
     Son extrait est grossi de 4 % dans un disque. La copie est inerte, sans identifiants ni champs. */
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const lens = document.createElement('div');
  lens.className = 'al-cursor-lens';
  lens.setAttribute('aria-hidden', 'true');
  lens.inert = true;
  const lensWindow = document.createElement('div');
  lensWindow.className = 'al-lens-window';
  const lensCopy = document.createElement('div');
  lensCopy.className = 'al-lens-copy';
  lensWindow.append(lensCopy);
  lens.append(lensWindow);
  root.append(lens);
  /* ✏️ MODIFIABLE : retard doux du suivi (en millisecondes), taille et zoom dans les variables CSS. */
  const followDelay = 55;
  let lensFrame = 0, lastFrame = 0, lensSource = null, sourceRect = null;
  let lensX = 0, lensY = 0, targetX = 0, targetY = 0, lensActive = false;
  let lensRadius = 39, lensZoom = 1.04;
  const readLensSettings = () => {
    const style = getComputedStyle(root);
    lensRadius = parseFloat(style.getPropertyValue('--al-lens-size')) / 2;
    lensZoom = parseFloat(style.getPropertyValue('--al-lens-zoom'));
  };
  readLensSettings();
  hideCursorLens = () => {
    lensActive = false;
    lens.classList.remove('is-visible');
    cancelAnimationFrame(lensFrame);
    lensFrame = 0;
  };
  const resetLens = () => {
    hideCursorLens();
    lensSource = sourceRect = null;
    lensCopy.replaceChildren();
  };
  /* La copie conserve uniquement la présentation. Aucun champ, lien actif ou script n'est reproduit. */
  const copyLensSection = source => {
    const copy = source.cloneNode(true);
    copy.querySelectorAll('script,iframe,object,embed,form,input,textarea,select,button,video,audio,[contenteditable]').forEach(node => node.remove());
    [copy, ...copy.querySelectorAll('*')].forEach(node => {
      for (const attr of [...node.attributes]) {
        if (attr.name === 'id' || attr.name === 'name' || attr.name === 'href' || attr.name === 'for' || attr.name === 'autofocus' || attr.name.startsWith('aria-') || attr.name.startsWith('on')) node.removeAttribute(attr.name);
      }
      if (node.tagName === 'A') node.setAttribute('tabindex', '-1');
      if (node.tagName === 'IMG') {node.loading = 'eager'; node.alt = '';}
    });
    copy.style.width = sourceRect.width+'px';
    copy.style.height = sourceRect.height+'px';
    copy.style.margin = '0';
    /* Le papier opaque évite de superposer le texte agrandi au texte d'origine. */
    lensCopy.style.backgroundColor = getComputedStyle(root.querySelector('.al-site')).backgroundColor;
    lensCopy.style.width = sourceRect.width+'px';
    lensCopy.style.height = sourceRect.height+'px';
    lensCopy.replaceChildren(copy);
    lensSource = source;
  };
  /* Le calcul s'arrête dès que le curseur est rejoint : aucune boucle permanente à l'arrêt. */
  const drawLens = now => {
    lensFrame = 0;
    if (!lensActive || !sourceRect) return;
    const elapsed = Math.min(now - lastFrame || 16, 40);
    lastFrame = now;
    const catchup = 1 - Math.exp(-elapsed / followDelay);
    lensX += (targetX - lensX) * catchup;
    lensY += (targetY - lensY) * catchup;
    lens.style.transform = `translate3d(${lensX-lensRadius}px,${lensY-lensRadius}px,0)`;
    lensCopy.style.transform = `translate3d(${lensRadius+(sourceRect.left-lensX)*lensZoom}px,${lensRadius+(sourceRect.top-lensY)*lensZoom}px,0) scale(${lensZoom})`;
    if (Math.abs(targetX-lensX)+Math.abs(targetY-lensY) > .12) lensFrame = requestAnimationFrame(drawLens);
  };
  const blockedLensTarget = 'a,button,summary,form,input,textarea,select,label,[contenteditable],.al-header,.al-drawer,.al-preview-tools,.al-instagram';
  const updateCursorLens = event => {
    if (!finePointer.matches || reducedMotion.matches || event.pointerType !== 'mouse' || event.buttons || !drawer.hidden || event.target.closest(blockedLensTarget)) {hideCursorLens();return;}
    const section = event.target.closest('main > section');
    /* Les formulaires restent hors de l'effet, y compris leurs coordonnées et la saisie en cours. */
    if (!section || section.querySelector('form') || document.activeElement?.closest('input,textarea,select,[contenteditable]')) {hideCursorLens();return;}
    const bounds = section.getBoundingClientRect();
    const headerBottom = root.querySelector('.al-header').getBoundingClientRect().bottom;
    const margin = lensRadius + 5;
    if (event.clientX < margin || event.clientX > innerWidth-margin || event.clientY < headerBottom+margin || event.clientY > innerHeight-margin || event.clientY < bounds.top+margin || event.clientY > bounds.bottom-margin) {hideCursorLens();return;}
    targetX = event.clientX;
    targetY = event.clientY;
    const changedSection = lensSource !== section;
    sourceRect = bounds;
    if (changedSection) copyLensSection(section);
    if (!lensActive || changedSection) {
      lensX = targetX; lensY = targetY;
      lastFrame = performance.now();
      lensActive = true;
      lens.classList.add('is-visible');
    }
    if (!lensFrame) lensFrame = requestAnimationFrame(drawLens);
  };
  document.addEventListener('pointermove', updateCursorLens, {passive:true});
  /* Un clic dans le décor conserve l'effet ; une sélection ou un contrôle l'efface. */
  document.addEventListener('pointerdown', hideCursorLens, {passive:true});
  document.addEventListener('pointerup', event => {
    if (window.getSelection()?.toString()) {hideCursorLens();return;}
    updateCursorLens(event);
  }, {passive:true});
  document.addEventListener('pointerout', event => {if (!event.relatedTarget) hideCursorLens();}, {passive:true});
  document.addEventListener('keydown', hideCursorLens);
  document.addEventListener('click', event => {if (event.target.closest(blockedLensTarget)) resetLens();});
  window.addEventListener('scroll', resetLens, {passive:true});
  window.addEventListener('resize', () => {resetLens();readLensSettings();}, {passive:true});
  window.addEventListener('blur', hideCursorLens);
  window.addEventListener('pagehide', resetLens);
  document.addEventListener('visibilitychange', () => {if (document.hidden) resetLens();});
  finePointer.addEventListener('change', resetLens);
  reducedMotion.addEventListener('change', resetLens);

  /* Aucun appel à Instagram avant le clic. Le profil natif fournit la sélection courante ;
     les trois images locales sont un aperçu daté, utilisable même si Instagram est bloqué. */
  const instagramLoad = root.querySelector('#instagram-load');
  if (instagramLoad) {
    const profileUrl = 'https://www.instagram.com/annelandrin.psychopedagogue/';
    const preview = root.querySelector('#instagram-preview');
    const live = root.querySelector('#instagram-live');
    const status = root.querySelector('#instagram-status');
    const back = root.querySelector('#instagram-back');
    let sdkPromise = null;
    let attempt = 0;
    let timer = 0;
    let observer = null;
    const loadInstagramSdk = () => {
      if (window.instgrm?.Embeds) return Promise.resolve();
      if (sdkPromise) return sdkPromise;
      sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://www.instagram.com/embed.js';
        script.async = true;
        const rejectLoad = () => {
          clearTimeout(sdkTimer);
          script.onload = script.onerror = null;
          script.remove();
          sdkPromise = null;
          reject(new Error('Instagram indisponible'));
        };
        const sdkTimer = setTimeout(rejectLoad, 15000);
        script.onload = () => {
          clearTimeout(sdkTimer);
          if (window.instgrm?.Embeds) resolve();
          else rejectLoad();
        };
        script.onerror = rejectLoad;
        document.body.append(script);
      });
      return sdkPromise;
    };
    instagramLoad.hidden = false;
    back.addEventListener('click', () => {
      ++attempt;
      clearTimeout(timer);
      observer?.disconnect();
      live.replaceChildren();
      live.hidden = true;
      live.removeAttribute('aria-busy');
      preview.hidden = false;
      back.hidden = true;
      instagramLoad.disabled = false;
      instagramLoad.setAttribute('aria-expanded','false');
      instagramLoad.textContent = 'Afficher les publications récentes';
      status.textContent = '';
      instagramLoad.focus({preventScroll:true});
    });
    instagramLoad.addEventListener('click', async () => {
      const current = ++attempt;
      clearTimeout(timer);
      observer?.disconnect();
      instagramLoad.disabled = true;
      instagramLoad.textContent = 'Chargement des publications…';
      back.hidden = false;
      status.textContent = 'Connexion à Instagram en cours.';
      live.hidden = false;
      live.setAttribute('aria-busy', 'true');
      instagramLoad.setAttribute('aria-expanded', 'true');
      const blockquote = document.createElement('blockquote');
      blockquote.className = 'instagram-media';
      blockquote.dataset.instgrmPermalink = profileUrl;
      blockquote.dataset.instgrmVersion = '14';
      const link = document.createElement('a');
      link.href = profileUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Voir les publications sur Instagram';
      blockquote.append(link);
      live.replaceChildren(blockquote);
      const fail = () => {
        if (current !== attempt) return;
        clearTimeout(timer);
        observer?.disconnect();
        ++attempt;
        live.hidden = true;
        preview.hidden = false;
        back.hidden = true;
        live.removeAttribute('aria-busy');
        instagramLoad.setAttribute('aria-expanded','false');
        instagramLoad.disabled = false;
        instagramLoad.textContent = 'Réessayer de charger Instagram';
        status.textContent = 'Instagram n’a pas pu être chargé. Les vignettes restent accessibles ; vous pouvez aussi ouvrir le profil avec le lien ci-dessus.';
      };
      observer = new MutationObserver(() => {
        const frame = live.querySelector('iframe');
        if (!frame || current !== attempt) return;
        observer.disconnect();
        frame.title = 'Publications Instagram de Anne Landrin';
        frame.addEventListener('load', () => {
          if (current !== attempt) return;
          clearTimeout(timer);
          live.removeAttribute('aria-busy');
          preview.hidden = true;
          instagramLoad.disabled = false;
          instagramLoad.textContent = 'Recharger les publications';
          status.textContent = 'Contenu fourni par Instagram. Si l’aperçu est indisponible, vous pouvez ouvrir le profil avec le lien ci-dessus.';
        }, {once:true});
      });
      observer.observe(live, {childList:true,subtree:true});
      timer = setTimeout(fail, 20000);
      try {
        await loadInstagramSdk();
        if (current === attempt) window.instgrm.Embeds.process();
      } catch {fail();}
    });
  }

  /* Form.taxi : confirmation sur place pour le site HTTP(S).
     Depuis un fichier local ou sans JavaScript, le POST HTML conserve le parcours natif
     du service (y compris sa confirmation en français). Aucun destinataire dans le code. */
  const form = root.querySelector('#contact-form');
  if (form && /^https?:$/.test(window.location.protocol) && window.fetch && window.AbortController) {
    const status = root.querySelector('#form-status');
    const button = form.querySelector('button[type="submit"]');
    let sending = false;
    const showStatus = (message, state) => {
      status.hidden = false;
      status.dataset.state = state;
      status.textContent = message;
    };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      const data = new FormData(form);
      sending = true;
      button.disabled = true;
      button.textContent = 'Envoi en cours…';
      form.setAttribute('aria-busy', 'true');
      // Empêche la modification d'un texte qui serait effacé au retour du service.
      const fields = [...form.querySelectorAll('input, textarea')].filter(field => !field.disabled);
      fields.forEach(field => {field.disabled = true;});
      showStatus('Votre message est en cours de transmission.', 'pending');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(form.action, {
          method:'POST', body:data, headers:{Accept:'application/json'},
          credentials:'omit', signal:controller.signal
        });
        const result = await response.json();
        if (response.status === 200 && result?.success === true) {
          form.reset();
          showStatus('Merci, votre message a bien été transmis. Je reviendrai vers vous pour échanger sur votre demande.', 'success');
        } else {
          showStatus('Le service n’a pas confirmé l’envoi. Votre texte est conservé. Vous pouvez réessayer plus tard ou me joindre au 06 13 97 10 14.', 'error');
        }
      } catch {
        // Pas de nouvel envoi automatique : le premier pourrait déjà avoir été reçu.
        showStatus('La confirmation d’envoi n’a pas pu être reçue. Votre message a peut-être été transmis et votre texte est conservé. Pour éviter un doublon, vous pouvez me joindre au 06 13 97 10 14.', 'error');
      } finally {
        clearTimeout(timeout);
        sending = false;
        fields.forEach(field => {field.disabled = false;});
        button.disabled = false;
        button.textContent = 'Envoyer mon message';
        form.removeAttribute('aria-busy');
        status.focus({preventScroll:true});
      }
    });
  }
})();
