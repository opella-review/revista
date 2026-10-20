(() => {
  'use strict';

  const TOTAL_PAGES = 9;
  const TURN_MS = 720;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.25;
  const DOUBLE_TAP_ZOOM = 2.15;

  const pageMeta = {
    1: { ratio: 576 / 648, portrait: true },
    2: { ratio: 1152 / 648, portrait: false },
    3: { ratio: 1152 / 648, portrait: false },
    4: { ratio: 1152 / 648, portrait: false },
    5: { ratio: 1152 / 648, portrait: false },
    6: { ratio: 1152 / 648, portrait: false },
    7: { ratio: 1152 / 648, portrait: false },
    8: { ratio: 1152 / 648, portrait: false },
    9: { ratio: 576 / 648, portrait: true }
  };

  const pagePath = (n) => `pages/page-${String(n).padStart(2, '0')}.webp`;
  const thumbPath = (n) => `thumbs/page-${String(n).padStart(2, '0')}.webp`;

  const el = {
    openReaderBtn: document.getElementById('openReaderBtn'),
    readerSection: document.getElementById('revista'),
    readerShell: document.getElementById('readerShell'),
    readerCanvas: document.getElementById('readerCanvas'),
    pageStage: document.getElementById('pageStage'),
    frontLayer: document.getElementById('frontLayer'),
    backLayer: document.getElementById('backLayer'),
    frontPage: document.getElementById('frontPage'),
    backPage: document.getElementById('backPage'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    pageIndicator: document.getElementById('pageIndicator'),
    thumbsBtn: document.getElementById('thumbsBtn'),
    closeThumbsBtn: document.getElementById('closeThumbsBtn'),
    thumbDrawer: document.getElementById('thumbDrawer'),
    thumbGrid: document.getElementById('thumbGrid'),
    drawerBackdrop: document.getElementById('drawerBackdrop'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    swipeHint: document.getElementById('swipeHint')
  };

  let currentPage = 1;
  let animating = false;
  let focusMode = false;
  let savedScrollY = 0;
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let mousePanStart = null;
  let touchStart = null;
  let pinchStart = null;
  let lastTap = { time: 0, x: 0, y: 0 };
  let resizeTimer = null;

  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  const isReadingMode = () => document.fullscreenElement === el.readerShell || focusMode;
  const readerHasFocus = () => isReadingMode() || el.readerShell.contains(document.activeElement);

  function fitLayer(layer, pageNumber) {
    const meta = pageMeta[pageNumber];
    const bounds = el.readerCanvas.getBoundingClientRect();
    const mobile = isMobile();
    const padX = mobile ? 18 : 52;
    const padY = mobile ? 86 : 64;
    const maxW = Math.max(220, bounds.width - padX);
    const maxH = Math.max(220, bounds.height - padY);
    let width = maxW;
    let height = width / meta.ratio;
    if (height > maxH) {
      height = maxH;
      width = height * meta.ratio;
    }
    layer.style.width = `${Math.floor(width)}px`;
    layer.style.height = `${Math.floor(height)}px`;
  }

  function fitVisibleLayers(targetPage = currentPage) {
    fitLayer(el.frontLayer, currentPage);
    fitLayer(el.backLayer, targetPage);
  }

  function updateControls() {
    el.pageIndicator.textContent = `${currentPage} / ${TOTAL_PAGES}`;
    el.prevBtn.disabled = currentPage <= 1 || animating;
    el.nextBtn.disabled = currentPage >= TOTAL_PAGES || animating;
    el.zoomResetBtn.textContent = `${Math.round(zoomScale * 100)}%`;
    el.zoomOutBtn.disabled = zoomScale <= MIN_ZOOM + 0.001;
    el.zoomInBtn.disabled = zoomScale >= MAX_ZOOM - 0.001;
    el.thumbGrid.querySelectorAll('.thumb').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.page) === currentPage);
    });
  }

  function clampPan() {
    if (zoomScale <= 1.001) {
      panX = 0;
      panY = 0;
      return;
    }
    const rect = el.readerCanvas.getBoundingClientRect();
    const maxX = (rect.width * (zoomScale - 1)) / 2;
    const maxY = (rect.height * (zoomScale - 1)) / 2;
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function applyZoom(animate = false) {
    clampPan();
    el.pageStage.classList.toggle('zoom-animate', animate);
    el.pageStage.style.setProperty('--zoom', zoomScale.toFixed(4));
    el.pageStage.style.setProperty('--pan-x', `${panX.toFixed(2)}px`);
    el.pageStage.style.setProperty('--pan-y', `${panY.toFixed(2)}px`);
    el.readerCanvas.classList.toggle('is-zoomed', zoomScale > 1.01);
    updateControls();
    if (animate) setTimeout(() => el.pageStage.classList.remove('zoom-animate'), 220);
  }

  function resetZoom(animate = false) {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    mousePanStart = null;
    pinchStart = null;
    el.readerCanvas.classList.remove('is-panning');
    applyZoom(animate);
  }

  function zoomAt(x, y, target, animate = false) {
    const rect = el.readerCanvas.getBoundingClientRect();
    const pointX = x - (rect.left + rect.width / 2);
    const pointY = y - (rect.top + rect.height / 2);
    const old = zoomScale;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, target));
    if (Math.abs(next - old) < .001) return;
    panX = pointX - (next * (pointX - panX) / old);
    panY = pointY - (next * (pointY - panY) / old);
    zoomScale = next;
    applyZoom(animate);
  }

  function setZoom(target) {
    const rect = el.readerCanvas.getBoundingClientRect();
    if (target <= 1.001) return resetZoom(true);
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, target, true);
  }

  function loadPageImage(img, n) {
    img.src = pagePath(n);
    img.alt = n === 1 ? 'Portada de Opella Winter Evolution' : `Página ${n} de Opella Winter Evolution`;
  }

  function render(page = currentPage) {
    currentPage = Math.max(1, Math.min(TOTAL_PAGES, page));
    loadPageImage(el.frontPage, currentPage);
    loadPageImage(el.backPage, currentPage);
    el.frontLayer.classList.remove('turn-forward', 'turn-backward');
    el.backLayer.classList.remove('reveal-next');
    fitVisibleLayers(currentPage);
    updateControls();
    prefetch(currentPage - 1);
    prefetch(currentPage + 1);
  }

  function prefetch(n) {
    if (n < 1 || n > TOTAL_PAGES) return;
    const img = new Image();
    img.src = pagePath(n);
  }

  function turnTo(targetPage, direction) {
    if (animating || targetPage < 1 || targetPage > TOTAL_PAGES) return;
    if (zoomScale > 1.01) resetZoom(false);
    animating = true;
    updateControls();
    loadPageImage(el.backPage, targetPage);
    fitVisibleLayers(targetPage);
    requestAnimationFrame(() => {
      el.backLayer.classList.add('reveal-next');
      el.frontLayer.classList.add(direction === 'next' ? 'turn-forward' : 'turn-backward');
    });
    setTimeout(() => {
      currentPage = targetPage;
      animating = false;
      render(currentPage);
    }, TURN_MS + 20);
  }

  const nextPage = () => turnTo(currentPage + 1, 'next');
  const prevPage = () => turnTo(currentPage - 1, 'prev');

  function goToPage(n) {
    if (animating) return;
    currentPage = Math.max(1, Math.min(TOTAL_PAGES, Number(n)));
    closeDrawer();
    resetZoom(false);
    render(currentPage);
    el.readerCanvas.focus({ preventScroll: true });
  }

  function buildThumbnails() {
    const frag = document.createDocumentFragment();
    for (let n = 1; n <= TOTAL_PAGES; n += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `thumb${pageMeta[n].portrait ? ' portrait' : ''}`;
      button.dataset.page = String(n);
      button.setAttribute('aria-label', n === 1 ? 'Ir a portada' : `Ir a página ${n}`);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = thumbPath(n);
      img.alt = '';
      const label = document.createElement('span');
      label.textContent = n === 1 ? 'Portada' : n === TOTAL_PAGES ? 'Contraportada' : `Página ${n}`;
      button.append(img, label);
      button.addEventListener('click', () => goToPage(n));
      frag.append(button);
    }
    el.thumbGrid.append(frag);
  }

  function openDrawer() {
    el.thumbDrawer.classList.add('open');
    el.drawerBackdrop.classList.add('open');
    el.thumbDrawer.setAttribute('aria-hidden', 'false');
    const active = el.thumbGrid.querySelector('.thumb.active');
    if (active) active.scrollIntoView({ block: 'center' });
  }

  function closeDrawer() {
    el.thumbDrawer.classList.remove('open');
    el.drawerBackdrop.classList.remove('open');
    el.thumbDrawer.setAttribute('aria-hidden', 'true');
  }

  function lockScroll() {
    savedScrollY = window.scrollY || 0;
    document.body.classList.add('reader-focus-active');
  }

  function unlockScroll() {
    document.body.classList.remove('reader-focus-active');
    window.scrollTo(0, savedScrollY);
  }

  function enterFocusMode() {
    focusMode = true;
    el.readerShell.classList.add('reading-active');
    lockScroll();
    el.fullscreenBtn.setAttribute('title', 'Salir de pantalla completa');
    setTimeout(() => { fitVisibleLayers(currentPage); }, 60);
  }

  function exitFocusMode() {
    focusMode = false;
    el.readerShell.classList.remove('reading-active');
    unlockScroll();
    resetZoom(false);
    el.fullscreenBtn.setAttribute('title', 'Pantalla completa');
    setTimeout(() => { fitVisibleLayers(currentPage); }, 60);
  }

  async function toggleFullscreen() {
    if (focusMode) return exitFocusMode();
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (document.fullscreenEnabled && typeof el.readerShell.requestFullscreen === 'function') {
      try {
        await el.readerShell.requestFullscreen();
        return;
      } catch (_) {}
    }
    enterFocusMode();
  }

  function openReader() {
    el.readerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => el.readerCanvas.focus({ preventScroll: true }), 650);
  }

  function distance(a, b) { return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); }
  function midpoint(a, b) { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }

  function handleDoubleTap(x, y) {
    const now = Date.now();
    const near = Math.hypot(x - lastTap.x, y - lastTap.y) < 46;
    if (now - lastTap.time < 320 && near) {
      zoomScale > 1.01 ? resetZoom(true) : zoomAt(x, y, DOUBLE_TAP_ZOOM, true);
      lastTap = { time: 0, x: 0, y: 0 };
    } else {
      lastTap = { time: now, x, y };
    }
  }

  el.openReaderBtn.addEventListener('click', openReader);
  el.prevBtn.addEventListener('click', prevPage);
  el.nextBtn.addEventListener('click', nextPage);
  el.pageIndicator.addEventListener('click', openDrawer);
  el.thumbsBtn.addEventListener('click', openDrawer);
  el.closeThumbsBtn.addEventListener('click', closeDrawer);
  el.drawerBackdrop.addEventListener('click', closeDrawer);
  el.fullscreenBtn.addEventListener('click', toggleFullscreen);
  el.zoomOutBtn.addEventListener('click', () => setZoom(zoomScale - ZOOM_STEP));
  el.zoomResetBtn.addEventListener('click', () => resetZoom(true));
  el.zoomInBtn.addEventListener('click', () => setZoom(zoomScale + ZOOM_STEP));

  el.readerCanvas.addEventListener('mousedown', (event) => {
    if (zoomScale <= 1.01 || event.button !== 0) return;
    event.preventDefault();
    mousePanStart = { x: event.clientX, y: event.clientY, panX, panY };
    el.readerCanvas.classList.add('is-panning');
  });
  window.addEventListener('mousemove', (event) => {
    if (!mousePanStart) return;
    panX = mousePanStart.panX + (event.clientX - mousePanStart.x);
    panY = mousePanStart.panY + (event.clientY - mousePanStart.y);
    applyZoom(false);
  });
  window.addEventListener('mouseup', () => {
    mousePanStart = null;
    el.readerCanvas.classList.remove('is-panning');
  });

  el.readerCanvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
      if (!isReadingMode()) return;
      const a = event.touches[0], b = event.touches[1];
      const mid = midpoint(a, b);
      pinchStart = { distance: distance(a,b), scale: zoomScale, panX, panY, midX: mid.x, midY: mid.y };
      touchStart = null;
      if (isReadingMode()) event.preventDefault();
      return;
    }
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now(), panX, panY };
  }, { passive: false });

  el.readerCanvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 2 && pinchStart) {
      if (isReadingMode()) event.preventDefault();
      const a = event.touches[0], b = event.touches[1];
      const mid = midpoint(a,b);
      const ratio = distance(a,b) / Math.max(1,pinchStart.distance);
      zoomScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStart.scale * ratio));
      panX = pinchStart.panX + (mid.x - pinchStart.midX);
      panY = pinchStart.panY + (mid.y - pinchStart.midY);
      applyZoom(false);
      return;
    }
    if (event.touches.length === 1 && zoomScale > 1.01 && touchStart) {
      if (isReadingMode()) event.preventDefault();
      const t = event.touches[0];
      panX = touchStart.panX + (t.clientX - touchStart.x);
      panY = touchStart.panY + (t.clientY - touchStart.y);
      applyZoom(false);
    }
  }, { passive: false });

  el.readerCanvas.addEventListener('touchend', (event) => {
    if (pinchStart) {
      if (event.touches.length < 2) pinchStart = null;
      if (zoomScale < 1.04) resetZoom(true);
      return;
    }
    if (!touchStart || !event.changedTouches.length) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const elapsed = Date.now() - touchStart.time;
    const moved = Math.hypot(dx,dy);
    const wasZoomed = zoomScale > 1.01;
    touchStart = null;
    if (wasZoomed) {
      if (moved < 12 && elapsed < 280) handleDoubleTap(t.clientX,t.clientY);
      return;
    }
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      dx < 0 ? nextPage() : prevPage();
      return;
    }
    if (moved < 12 && elapsed < 280) handleDoubleTap(t.clientX,t.clientY);
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (!readerHasFocus()) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); nextPage(); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); prevPage(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoomScale + ZOOM_STEP); }
    else if (event.key === '-') { event.preventDefault(); setZoom(zoomScale - ZOOM_STEP); }
    else if (event.key === '0') { event.preventDefault(); resetZoom(true); }
    else if (event.key === 'Escape' && el.thumbDrawer.classList.contains('open')) closeDrawer();
    else if (event.key === 'Escape' && focusMode) exitFocusMode();
  });

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fitVisibleLayers(currentPage);
      resetZoom(false);
    }, 120);
  }
  window.addEventListener('resize', handleResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', handleResize);

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === el.readerShell) {
      el.readerShell.classList.add('reading-active');
      el.fullscreenBtn.setAttribute('title', 'Salir de pantalla completa');
    } else if (!focusMode) {
      el.readerShell.classList.remove('reading-active');
      el.fullscreenBtn.setAttribute('title', 'Pantalla completa');
      resetZoom(false);
    }
    setTimeout(() => fitVisibleLayers(currentPage), 80);
  });

  buildThumbnails();
  render(1);
})();
