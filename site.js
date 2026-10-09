(() => {
  'use strict';
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${(window.ARIZONA_ICONS || {})[name] || ''}</svg>`;
  const hydrateIcons = (context = document) => $$('[data-icon]', context).forEach(node => { node.innerHTML = icon(node.dataset.icon); });
  hydrateIcons();
  const data = window.ARIZONA_DATA;
  if (!data || !Array.isArray(data.frames) || !Array.isArray(data.chapters)) {
    $('#frames').innerHTML = '<p class="loading-message">Файл data.js не загрузился. Откройте index.html вместе с остальными файлами презентации.</p>';
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const records = new Map();
  const imageFor = (frame, key) => frame.images.find(image => image.key === key) || frame.images[0];
  const labelFor = (frame, image, short = false) => image.key === 'original' ? 'Исходник' : image.key === 'final' ? (short ? 'Финал + Photoshop' : `${image.model || frame.finalModel || 'Нейросеть'} + Photoshop`) : image.label || image.model || image.key;
  const options = (frame, selected) => frame.images.map(image => `<option value="${esc(image.key)}"${image.key === selected ? ' selected' : ''}>${esc(labelFor(frame, image, true))}</option>`).join('');
  const imageMarkup = (image, alt, type = 'preview') => `<img src="${esc(image[type] || image.preview || image.thumb)}" width="${Number(image.width) || 1}" height="${Number(image.height) || 1}" alt="${esc(alt)}" loading="lazy" decoding="async" draggable="false">`;
  const frameMarkup = frame => {
    const original = imageFor(frame, 'original');
    const final = imageFor(frame, 'final');
    const models = ['qwen', 'nano', 'gpt'].map(key => frame.images.find(image => image.key === key)).filter(Boolean);
    return `<article class="frame" id="frame-${esc(frame.id)}" data-frame="${esc(frame.id)}" aria-labelledby="title-${esc(frame.id)}">
      <div class="frame-heading"><h3 id="title-${esc(frame.id)}">${esc(frame.title || frame.id)}</h3><p>Финал: ${esc(frame.finalModel || final.model || 'нейросеть')} + Photoshop</p></div>
      ${frame.notes ? `<p class="frame-note">${esc(frame.notes)}</p>` : ''}
      <div class="comparison" style="--photo-ratio:${(Number(original.width) || 3) / (Number(original.height) || 4)}"><div class="comparison-toolbar"><div class="pair-selects"><label>Слева<select class="pair-left" aria-label="Фотография слева для ${esc(frame.id)}">${options(frame, 'original')}</select></label><label>Справа<select class="pair-right" aria-label="Фотография справа для ${esc(frame.id)}">${options(frame, 'final')}</select></label></div><button class="open-viewer" type="button">${icon('maximize')}Открыть крупно</button></div>
        <div class="compare-stage"><div class="compare-image compare-before">${imageMarkup(original, `${frame.id}: исходник`)}</div><div class="compare-image compare-after">${imageMarkup(final, `${frame.id}: финал`)}</div><div class="compare-divider" aria-hidden="true"><span>‹ ›</span></div><input class="compare-range" type="range" min="0" max="100" value="50" aria-label="Граница сравнения фотографий ${esc(frame.id)}"></div>
        <div class="compare-labels"><span class="pair-label-left">Исходник</span><span class="pair-label-right">${esc(labelFor(frame, final))}</span></div><p class="comparison-hint">Потяните границу. Для деталей откройте фотографии крупно.</p>
      </div>
      <div class="model-results"><div class="models-heading"><h4>Первые результаты нейросетей</h4><p>До финальной обработки в Photoshop</p></div><div class="model-grid">${models.map(image => `<figure class="model-card"><button class="model-image" type="button" data-model="${esc(image.key)}" aria-label="Открыть ${esc(image.label || image.model)} для кадра ${esc(frame.id)}">${imageMarkup(image, `${frame.id}: ${image.label || image.model}`, 'thumb')}<span class="model-zoom">${icon('zoom-in')}</span></button><figcaption><span>${esc(image.label || image.model)}</span><small>Первая генерация</small></figcaption></figure>`).join('')}</div></div>
    </article>`;
  };
  $('#frames').innerHTML = data.frames.map(frameMarkup).join('');
  data.frames.forEach(frame => {
    const element = $$('[data-frame]').find(item => item.dataset.frame === String(frame.id));
    const record = { frame, element, left: 'original', right: 'final', split: 50 };
    records.set(String(frame.id), record);
    const update = () => {
      ['left', 'right'].forEach(side => {
        const image = imageFor(frame, record[side]);
        const tag = $(`.compare-${side === 'left' ? 'before' : 'after'} img`, element);
        tag.src = image.preview || image.thumb;
        tag.alt = `${frame.id}: ${labelFor(frame, image)}`;
        tag.width = Number(image.width) || 1;
        tag.height = Number(image.height) || 1;
        $(`.pair-${side}`, element).value = image.key;
        $(`.pair-label-${side}`, element).textContent = labelFor(frame, image);
      });
    };
    ['left', 'right'].forEach(side => $(`.pair-${side}`, element).addEventListener('change', event => {
      const other = side === 'left' ? 'right' : 'left';
      if (event.target.value === record[other]) record[other] = record[side];
      record[side] = event.target.value;
      update();
    }));
    $('.compare-range', element).addEventListener('input', event => {
      record.split = Number(event.target.value);
      $('.compare-stage', element).style.setProperty('--split', `${record.split}%`);
    });
    $('.open-viewer', element).addEventListener('click', event => openViewer(record, record.left, record.right, event.currentTarget));
    $$('[data-model]', element).forEach(button => button.addEventListener('click', event => openViewer(record, record.left === button.dataset.model ? 'original' : record.left, button.dataset.model, event.currentTarget, true)));
  });

  const heroFrame = data.frames.find(frame => String(frame.id).includes('05742')) || data.frames[0];
  if (heroFrame) {
    const image = imageFor(heroFrame, 'final');
    $('#hero-image').innerHTML = `<button type="button" aria-label="Открыть финальную фотографию ${esc(heroFrame.id)}">${imageMarkup(image, `Аризона и фургон: финальная фотография ${heroFrame.id}`)}</button>`;
    const heroImage = $('#hero-image img');
    heroImage.loading = 'eager';
    heroImage.setAttribute('fetchpriority', 'high');
    $('#hero-image button').addEventListener('click', event => openViewer(records.get(String(heroFrame.id)), 'original', 'final', event.currentTarget));
  }

  const demoMarkup = demo => `<figure class="demo" data-demo="${esc(demo.id)}"><div class="demo-video-wrap"><video muted loop playsinline preload="none" poster="${esc(demo.poster)}" width="${Number(demo.width) || 960}" height="${Number(demo.height) || 540}" aria-label="${esc(demo.title)}"><source data-src="${esc(demo.mp4)}" type="video/mp4"></video></div><figcaption><strong>${esc(demo.title)}</strong>${esc(demo.caption)}</figcaption><div class="demo-actions"><button class="demo-toggle" type="button" aria-pressed="false">${icon('play')}<span>Воспроизвести</span></button><a class="demo-expand" href="${esc(demo.mp4)}" target="_blank" rel="noopener noreferrer">${icon('maximize')}<span>Развернуть видео</span></a><a class="gif-link" href="${esc(demo.gif)}" download>${icon('download')}Скачать GIF</a></div></figure>`;
  const resourceLink = link => `<a class="${link.primary ? 'resource-download' : 'resource-link'}" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${link.primary ? icon(link.icon || 'download') : ''}${esc(link.label)}</a>`;
  const resourceMarkup = resource => resource ? `<aside class="chapter-resource" aria-label="${esc(resource.title)}"><div class="resource-heading"><h4>${esc(resource.title)}</h4></div><p>${esc(resource.description)}</p><div class="resource-links">${(resource.links || []).map(resourceLink).join('')}</div>${resource.requirements ? `<p class="resource-requirements">${esc(resource.requirements)}</p>` : ''}${resource.sections?.length ? `<div class="resource-guides">${resource.sections.map(section => `<details><summary>${esc(section.title)}</summary><ol>${section.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol></details>`).join('')}</div>` : ''}${resource.extraLinks?.length ? `<div class="resource-extra-links">${resource.extraLinks.map(resourceLink).join('')}</div>` : ''}${resource.note ? `<p class="resource-note">${esc(resource.note)}</p>` : ''}</aside>` : '';
  $('#chapters').innerHTML = data.chapters.map((chapter, index) => `<article class="chapter" id="chapter-${esc(chapter.id)}" aria-labelledby="chapter-title-${esc(chapter.id)}"><div class="chapter-heading"><span class="chapter-number">${String(chapter.num || index + 1).padStart(2, '0')}</span><h3 id="chapter-title-${esc(chapter.id)}">${esc(chapter.title)}</h3></div><p class="chapter-intro">${esc(chapter.intro)}</p><div class="chapter-body"><div class="chapter-copy"><ul>${(chapter.actions || []).map(action => `<li>${esc(action)}</li>`).join('')}</ul>${chapter.why ? `<h4>Зачем</h4><p>${esc(chapter.why)}</p>` : ''}${chapter.check ? `<div class="check-note"><h4>Что проверить</h4><p>${esc(chapter.check)}</p></div>` : ''}${chapter.settings ? `<p class="settings-note">${esc(chapter.settings)}</p>` : ''}${resourceMarkup(chapter.resource)}</div><div class="demos">${(chapter.demos || []).map(demoMarkup).join('')}</div></div></article>`).join('');
  $('#contents-links').innerHTML = `<a href="#top">Начало</a><p>Сравнение фотографий</p>${data.frames.map(frame => `<a href="#frame-${esc(frame.id)}">${esc(frame.title || frame.id)}</a>`).join('')}<p>Обработка по шагам</p>${data.chapters.map((chapter, index) => `<a href="#chapter-${esc(chapter.id)}"><span>${String(chapter.num || index + 1).padStart(2, '0')}</span>${esc(chapter.title)}</a>`).join('')}`;

  const contents = $('#contents');
  const contentsBackdrop = $('.contents-backdrop');
  const contentsButton = $('.contents-toggle');
  const closeContents = (returnFocus = false) => {
    contents.hidden = true;
    contentsBackdrop.hidden = true;
    contentsButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) contentsButton.focus();
  };
  contentsButton.addEventListener('click', () => {
    const opening = contents.hidden;
    contents.hidden = !opening;
    contentsBackdrop.hidden = !opening;
    contentsButton.setAttribute('aria-expanded', String(opening));
    if (opening) $('.contents-close').focus();
  });
  $('.contents-close').addEventListener('click', () => closeContents(true));
  contentsBackdrop.addEventListener('click', () => closeContents(true));
  $$('a', contents).forEach(link => link.addEventListener('click', () => closeContents(false)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !contents.hidden) closeContents(true); });
  const setRecording = enabled => {
    closeContents();
    document.body.classList.toggle('recording', enabled);
    $('#recording-toggle').setAttribute('aria-pressed', String(enabled));
    $('#recording-toggle').setAttribute('aria-label', enabled ? 'Выключить режим записи экрана' : 'Включить режим записи экрана');
    $('#recording-exit').hidden = !enabled;
  };
  $('#recording-toggle').addEventListener('click', () => setRecording(!document.body.classList.contains('recording')));
  $('#recording-exit').addEventListener('click', () => { setRecording(false); $('#recording-toggle').focus(); });

  // Load demonstrations near the viewport; remember an explicit pause.
  const videoStates = new Map();
  const paintVideoButton = state => {
    const playing = !state.video.paused;
    state.button.innerHTML = `${icon(playing ? 'pause' : 'play')}<span>${playing ? 'Пауза' : 'Воспроизвести'}</span>`;
    state.button.setAttribute('aria-pressed', String(playing));
    state.button.setAttribute('aria-label', `${playing ? 'Остановить' : 'Воспроизвести'}: ${state.video.getAttribute('aria-label')}`);
  };
  const loadVideo = state => {
    if (state.loaded) return;
    const source = $('source', state.video);
    source.src = source.dataset.src;
    state.video.load();
    state.loaded = true;
  };
  const playVideo = state => {
    loadVideo(state);
    state.video.muted = true;
    const result = state.video.play();
    if (result && result.catch) result.catch(() => paintVideoButton(state));
  };
  $$('.demo').forEach(figure => {
    const state = { video: $('video', figure), button: $('.demo-toggle', figure), loaded: false, visible: false, userPaused: false };
    videoStates.set(state.video, state);
    state.video.addEventListener('play', () => paintVideoButton(state));
    state.video.addEventListener('pause', () => paintVideoButton(state));
    state.video.addEventListener('error', () => {
      if ($('.demo-failure', figure)) return;
      const note = document.createElement('p');
      note.className = 'demo-failure';
      note.textContent = 'Не удалось открыть видео. Демонстрацию можно скачать в формате GIF.';
      $('.demo-video-wrap', figure).append(note);
    });
    state.button.addEventListener('click', () => {
      if (state.video.paused) { state.userPaused = false; playVideo(state); }
      else { state.userPaused = true; state.video.pause(); }
    });
    const expand = $('.demo-expand', figure);
    let nativeFullscreenFailed = false;
    const fallbackVideoControls = () => {
      nativeFullscreenFailed = true;
      state.video.controls = true;
      expand.innerHTML = `${icon('maximize')}<span>Открыть MP4</span>`;
      expand.title = 'Открыть видео в отдельной вкладке';
    };
    expand.addEventListener('click', event => {
      loadVideo(state);
      state.video.controls = true;
      if (nativeFullscreenFailed) return;
      if (typeof state.video.requestFullscreen === 'function') {
        event.preventDefault();
        try {
          const request = state.video.requestFullscreen();
          if (request?.catch) request.catch(fallbackVideoControls);
        } catch (_) { fallbackVideoControls(); }
      } else if (typeof state.video.webkitEnterFullscreen === 'function') {
        event.preventDefault();
        try { state.video.webkitEnterFullscreen(); } catch (_) { fallbackVideoControls(); }
      }
    });
    state.video.addEventListener('webkitendfullscreen', () => { state.video.controls = false; });
  });
  document.addEventListener('fullscreenchange', () => videoStates.forEach(state => {
    state.video.controls = document.fullscreenElement === state.video;
  }));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      const state = videoStates.get(entry.target);
      state.visible = entry.isIntersecting && entry.intersectionRatio >= .25;
      if (state.visible && !document.hidden && !reducedMotion.matches && !state.userPaused && !$('#viewer').open) playVideo(state);
      else state.video.pause();
    }), { threshold: [0, .25, .5] });
    videoStates.forEach(state => observer.observe(state.video));
  }
  const synchronizeVideos = () => videoStates.forEach(state => {
    if (!document.hidden && state.visible && !state.userPaused && !reducedMotion.matches && !$('#viewer').open) playVideo(state);
    else state.video.pause();
  });
  document.addEventListener('visibilitychange', synchronizeVideos);
  reducedMotion.addEventListener('change', synchronizeVideos);

  // Full-resolution comparison shares zoom/pan between the two layers.
  const viewer = $('#viewer');
  const viewport = $('#viewer-viewport');
  const leftImage = $('#viewer-image-left');
  const rightImage = $('#viewer-image-right');
  const viewerState = { record: null, left: 'original', right: 'final', split: 50, zoom: 1, x: 0, y: 0, opener: null, pointers: new Map(), drag: null, token: 0, generationContext: false };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const imageFit = side => {
    const frame = viewerState.record.frame;
    const original = imageFor(frame, 'original');
    const aspect = (Number(original.width) || 3) / (Number(original.height) || 4);
    const frameWidth = Math.min(viewport.clientWidth, viewport.clientHeight * aspect);
    const frameHeight = frameWidth / aspect;
    const image = imageFor(frame, viewerState[side]);
    const width = Number(image.width) || (side === 'left' ? leftImage.naturalWidth : rightImage.naturalWidth) || 1;
    const height = Number(image.height) || (side === 'left' ? leftImage.naturalHeight : rightImage.naturalHeight) || 1;
    const scale = Math.max(frameWidth / width, frameHeight / height);
    return { width: frameWidth, height: frameHeight, scale };
  };
  const comparisonBounds = () => {
    const photoWidth = Math.max(imageFit('left').width, imageFit('right').width) * viewerState.zoom;
    const center = viewport.clientWidth / 2 + viewerState.x;
    const left = Math.max(0, center - photoWidth / 2);
    const right = Math.min(viewport.clientWidth, center + photoWidth / 2);
    return { left, right, width: Math.max(1, right - left) };
  };
  const updateSplitPosition = () => {
    const bounds = comparisonBounds();
    const position = bounds.left + bounds.width * viewerState.split / 100;
    viewport.style.setProperty('--split', `${position}px`);
  };
  const applyTransform = () => {
    const leftFit = imageFit('left');
    const rightFit = imageFit('right');
    viewport.style.setProperty('--viewer-photo-width', `${leftFit.width}px`);
    viewport.style.setProperty('--viewer-photo-height', `${leftFit.height}px`);
    const limitX = Math.max(0, (Math.max(leftFit.width, rightFit.width) * viewerState.zoom - viewport.clientWidth) / 2);
    const limitY = Math.max(0, (Math.max(leftFit.height, rightFit.height) * viewerState.zoom - viewport.clientHeight) / 2);
    viewerState.x = clamp(viewerState.x, -limitX, limitX);
    viewerState.y = clamp(viewerState.y, -limitY, limitY);
    $$('.viewer-transform').forEach(element => { element.style.transform = `translate(${viewerState.x}px,${viewerState.y}px) scale(${viewerState.zoom})`; });
    $('#zoom-level').textContent = `${Math.round(viewerState.zoom * leftFit.scale * 100)}%`;
    $('#zoom-out').disabled = viewerState.zoom <= .1001;
    $('#zoom-in').disabled = viewerState.zoom >= 64;
    updateSplitPosition();
  };
  const fit = () => { viewerState.zoom = 1; viewerState.x = 0; viewerState.y = 0; applyTransform(); };
  const zoomAt = (nextZoom, clientX, clientY) => {
    const rect = viewport.getBoundingClientRect();
    const pointX = (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const pointY = (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
    const next = clamp(nextZoom, .1, 64);
    const factor = next / viewerState.zoom;
    viewerState.x = pointX - (pointX - viewerState.x) * factor;
    viewerState.y = pointY - (pointY - viewerState.y) * factor;
    viewerState.zoom = next;
    applyTransform();
  };
  const setSplit = value => {
    viewerState.split = clamp(value, 0, 100);
    updateSplitPosition();
    $('#viewer-range').value = viewerState.split;
  };
  const updateViewerImages = () => {
    const frame = viewerState.record.frame;
    const token = ++viewerState.token;
    const left = imageFor(frame, viewerState.left);
    const right = imageFor(frame, viewerState.right);
    $('#viewer-left').value = left.key;
    $('#viewer-right').value = right.key;
    $('#viewer-label-left').textContent = labelFor(frame, left);
    $('#viewer-label-right').textContent = labelFor(frame, right);
    $$('#generation-models button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.generation === right.key)));
    viewer.dataset.context = viewerState.generationContext ? 'generations' : 'comparison';
    $('#viewer-loading').hidden = false;
    $('#viewer-loading').textContent = 'Загрузка полных изображений…';
    let remaining = 2;
    let failed = false;
    [[leftImage, left], [rightImage, right]].forEach(([tag, image]) => {
      tag.onload = () => {
        if (token !== viewerState.token) return;
        remaining--;
        if (!remaining && !failed) $('#viewer-loading').hidden = true;
      };
      tag.onerror = () => {
        if (token !== viewerState.token) return;
        failed = true;
        $('#viewer-loading').textContent = 'Не удалось загрузить полное изображение. Проверьте файлы презентации.';
      };
      tag.alt = `${frame.id}: ${labelFor(frame, image)}`;
      tag.src = image.full || image.preview;
    });
    applyTransform();
  };
  function openViewer(record, left, right, opener, generationContext = false) {
    closeContents();
    Object.assign(viewerState, { record, left, right, split: record.split, opener, generationContext });
    $('#viewer-title').textContent = record.frame.title || record.frame.id;
    $('#viewer-left').innerHTML = options(record.frame, left);
    $('#viewer-right').innerHTML = options(record.frame, right);
    $('#generation-models').innerHTML = ['qwen', 'nano', 'gpt'].map(key => record.frame.images.find(image => image.key === key)).filter(Boolean).map(image => `<button class="generation-model" type="button" data-generation="${esc(image.key)}" aria-pressed="${String(image.key === right)}" aria-label="Первая генерация справа: ${esc(image.label || image.model)}">${esc(image.label || image.model)}</button>`).join('');
    $$('#generation-models button').forEach(button => button.addEventListener('click', () => selectGeneration(button.dataset.generation)));
    document.body.style.overflow = 'hidden';
    if (typeof viewer.showModal === 'function') viewer.showModal();
    else viewer.setAttribute('open', '');
    setSplit(record.split);
    fit();
    updateViewerImages();
    synchronizeVideos();
    $('#viewer-close').focus();
  }
  const closeViewer = () => {
    viewerState.token++;
    if (typeof viewer.close === 'function') viewer.close();
    else viewer.removeAttribute('open');
    document.body.style.overflow = '';
    viewerState.pointers.clear();
    viewerState.drag = null;
    viewport.classList.remove('dragging');
    leftImage.onload = rightImage.onload = leftImage.onerror = rightImage.onerror = null;
    leftImage.removeAttribute('src');
    rightImage.removeAttribute('src');
    synchronizeVideos();
    if (viewerState.opener?.isConnected) viewerState.opener.focus();
  };
  $('#viewer-close').addEventListener('click', closeViewer);
  viewer.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
  viewer.addEventListener('keydown', event => {
    const editing = event.target.closest('input,select,textarea,[contenteditable="true"]');
    if (!editing && ['ArrowLeft', 'ArrowRight'].includes(event.key) && !event.shiftKey) {
      event.preventDefault();
      navigateGeneration(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (!editing && event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      viewerState.x += event.key === 'ArrowLeft' ? 45 : event.key === 'ArrowRight' ? -45 : 0;
      viewerState.y += event.key === 'ArrowUp' ? 45 : event.key === 'ArrowDown' ? -45 : 0;
      applyTransform();
      return;
    }
    if (event.key === 'Tab') {
      const elements = $$('button:not(:disabled),select,input,[tabindex="0"]', viewer).filter(element => !element.hidden);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (event.key === 'Escape') { event.preventDefault(); closeViewer(); }
  });
  function selectGeneration(key) {
    if (!viewerState.record.frame.images.some(image => image.key === key)) return;
    if (viewerState.left === key) viewerState.left = viewerState.right === key ? 'original' : viewerState.right;
    viewerState.right = key;
    viewerState.generationContext = true;
    updateViewerImages();
  }
  function navigateGeneration(direction) {
    const keys = ['qwen', 'nano', 'gpt'].filter(key => viewerState.record.frame.images.some(image => image.key === key));
    if (!keys.length) return;
    const index = keys.indexOf(viewerState.right);
    const next = index < 0 ? (direction > 0 ? 0 : keys.length - 1) : (index + direction + keys.length) % keys.length;
    selectGeneration(keys[next]);
  }
  $('#generation-prev').addEventListener('click', () => navigateGeneration(-1));
  $('#generation-next').addEventListener('click', () => navigateGeneration(1));
  ['left', 'right'].forEach(side => $(`#viewer-${side}`).addEventListener('change', event => {
    const other = side === 'left' ? 'right' : 'left';
    if (event.target.value === viewerState[other]) viewerState[other] = viewerState[side];
    viewerState[side] = event.target.value;
    updateViewerImages();
  }));
  $('#viewer-swap').addEventListener('click', () => { [viewerState.left, viewerState.right] = [viewerState.right, viewerState.left]; updateViewerImages(); });
  $('#viewer-range').addEventListener('input', event => setSplit(Number(event.target.value)));
  $('#zoom-in').addEventListener('click', () => zoomAt(viewerState.zoom * 1.35));
  $('#zoom-out').addEventListener('click', () => zoomAt(viewerState.zoom / 1.35));
  $('#zoom-fit').addEventListener('click', fit);
  $('#zoom-actual').addEventListener('click', () => {
    const fitScale = imageFit('left').scale;
    viewerState.x = viewerState.y = 0;
    zoomAt(1 / fitScale);
  });
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    zoomAt(viewerState.zoom * Math.exp(-event.deltaY * .0015), event.clientX, event.clientY);
  }, { passive: false });
  viewport.addEventListener('dblclick', event => { if (viewerState.zoom > 1.01) fit(); else zoomAt(2, event.clientX, event.clientY); });
  const pointerDistance = () => {
    const points = [...viewerState.pointers.values()];
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture(event.pointerId);
    viewerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (viewerState.pointers.size === 2) {
      viewerState.drag = { type: 'pinch', distance: pointerDistance(), zoom: viewerState.zoom };
    } else {
      const rect = viewport.getBoundingClientRect();
      const bounds = comparisonBounds();
      const dividerX = rect.left + bounds.left + bounds.width * viewerState.split / 100;
      const divider = Math.abs(event.clientX - dividerX) < 25;
      viewerState.drag = { type: divider ? 'split' : 'pan', x: event.clientX, y: event.clientY, startX: viewerState.x, startY: viewerState.y };
    }
    viewport.classList.add('dragging');
  });
  viewport.addEventListener('pointermove', event => {
    if (!viewerState.pointers.has(event.pointerId)) return;
    viewerState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const drag = viewerState.drag;
    if (!drag) return;
    if (drag.type === 'pinch' && viewerState.pointers.size >= 2) {
      const points = [...viewerState.pointers.values()];
      zoomAt(drag.zoom * pointerDistance() / Math.max(1, drag.distance), (points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);
    } else if (drag.type === 'split') {
      const rect = viewport.getBoundingClientRect();
      const bounds = comparisonBounds();
      setSplit((event.clientX - rect.left - bounds.left) / bounds.width * 100);
    } else if (drag.type === 'pan') {
      viewerState.x = drag.startX + event.clientX - drag.x;
      viewerState.y = drag.startY + event.clientY - drag.y;
      applyTransform();
    }
  });
  const endPointer = event => {
    viewerState.pointers.delete(event.pointerId);
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (viewerState.pointers.size === 1) {
      const point = [...viewerState.pointers.values()][0];
      viewerState.drag = { type: 'pan', x: point.x, y: point.y, startX: viewerState.x, startY: viewerState.y };
    } else if (!viewerState.pointers.size) { viewerState.drag = null; viewport.classList.remove('dragging'); }
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key) || (event.shiftKey && ['ArrowUp', 'ArrowDown'].includes(event.key))) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === '+' || event.key === '=') zoomAt(viewerState.zoom * 1.2);
    else if (event.key === '-') zoomAt(viewerState.zoom / 1.2);
    else if (event.key === '0') fit();
    else {
      viewerState.x += event.key === 'ArrowLeft' ? 45 : event.key === 'ArrowRight' ? -45 : 0;
      viewerState.y += event.key === 'ArrowUp' ? 45 : event.key === 'ArrowDown' ? -45 : 0;
      applyTransform();
    }
  });
  window.addEventListener('resize', () => { if (viewer.open) applyTransform(); });
})();
