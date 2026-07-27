(function () {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  onReady(function () {
    var page = document.body;
    if (!page || !page.classList.contains('salary-interactions-page')) return;
    if (window.getComputedStyle(page).getPropertyValue('--salary-interactions-ready').trim() !== '1') return;

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var rotationTimer = 0;
    var rotationSlot = null;
    var currentPhrase = null;
    var incomingPhrase = null;
    var phraseSizer = null;
    var rotationPhrases = ['Без таблиц.', 'Без Excel.', 'Без блокнота и ручки.'];
    var rotationIndex = 0;
    var statementTimer = 0;
    var statementSlot = null;
    var currentStatementWord = null;
    var incomingStatementWord = null;
    var statementWords = ['Данные', 'Смены', 'Часы', 'Маршруты'];
    var statementIndex = 0;
    var revealObserver = null;

    function updatePhraseHeight() {
      if (!rotationSlot || !phraseSizer) return;
      rotationSlot.style.setProperty('--rotating-phrase-height', phraseSizer.scrollHeight + 'px');
    }

    function buildPhraseRotation() {
      var source = document.querySelector('.rotating-phrase-source');
      if (!source) return;

      rotationSlot = document.createElement('span');
      rotationSlot.className = 'rotating-phrase-slot';

      currentPhrase = document.createElement('span');
      currentPhrase.className = 'rotating-phrase rotating-phrase-current';
      currentPhrase.textContent = rotationPhrases[0];

      incomingPhrase = document.createElement('span');
      incomingPhrase.className = 'rotating-phrase rotating-phrase-incoming';
      incomingPhrase.textContent = rotationPhrases[1];
      incomingPhrase.setAttribute('aria-hidden', 'true');

      phraseSizer = document.createElement('span');
      phraseSizer.className = 'rotating-phrase rotating-phrase-sizer';
      phraseSizer.textContent = rotationPhrases[2];
      phraseSizer.setAttribute('aria-hidden', 'true');

      rotationSlot.appendChild(currentPhrase);
      rotationSlot.appendChild(incomingPhrase);
      rotationSlot.appendChild(phraseSizer);
      source.parentNode.replaceChild(rotationSlot, source);
      updatePhraseHeight();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(updatePhraseHeight);
      }
      window.addEventListener('resize', updatePhraseHeight);
    }

    function buildStatementRotation() {
      var source = document.querySelector('.statement-rotation-source');
      if (!source) return;

      statementSlot = document.createElement('span');
      statementSlot.className = 'statement-word-slot';

      currentStatementWord = document.createElement('span');
      currentStatementWord.className = 'statement-word statement-word-current';
      currentStatementWord.textContent = statementWords[0];

      incomingStatementWord = document.createElement('span');
      incomingStatementWord.className = 'statement-word statement-word-incoming';
      incomingStatementWord.textContent = statementWords[1];
      incomingStatementWord.setAttribute('aria-hidden', 'true');

      var statementSizer = document.createElement('span');
      statementSizer.className = 'statement-word statement-word-sizer';
      statementSizer.textContent = statementWords[3];
      statementSizer.setAttribute('aria-hidden', 'true');

      statementSlot.appendChild(currentStatementWord);
      statementSlot.appendChild(incomingStatementWord);
      statementSlot.appendChild(statementSizer);
      source.parentNode.replaceChild(statementSlot, source);
    }

    function clearRotation() {
      window.clearTimeout(rotationTimer);
      rotationTimer = 0;
      if (!rotationSlot) return;

      rotationSlot.classList.add('is-resetting');
      rotationSlot.classList.remove('is-rotating');
      if (currentPhrase) currentPhrase.textContent = rotationPhrases[0];
      if (incomingPhrase) incomingPhrase.textContent = rotationPhrases[1];
      rotationIndex = 0;
      rotationSlot.offsetWidth;
      rotationSlot.classList.remove('is-resetting');
    }

    function clearStatementRotation() {
      window.clearTimeout(statementTimer);
      statementTimer = 0;
      if (!statementSlot) return;

      statementSlot.classList.add('is-resetting');
      statementSlot.classList.remove('is-rotating');
      currentStatementWord.textContent = statementWords[0];
      incomingStatementWord.textContent = statementWords[1];
      statementIndex = 0;
      statementSlot.offsetWidth;
      statementSlot.classList.remove('is-resetting');
    }

    function scheduleRotation(delay) {
      window.clearTimeout(rotationTimer);
      if (motionQuery.matches || document.hidden || !rotationSlot) return;

      rotationTimer = window.setTimeout(function () {
        var nextIndex = (rotationIndex + 1) % rotationPhrases.length;
        incomingPhrase.textContent = rotationPhrases[nextIndex];
        rotationSlot.classList.add('is-rotating');

        rotationTimer = window.setTimeout(function () {
          rotationIndex = nextIndex;
          currentPhrase.textContent = rotationPhrases[rotationIndex];
          incomingPhrase.textContent = rotationPhrases[(rotationIndex + 1) % rotationPhrases.length];
          rotationSlot.classList.add('is-resetting');
          rotationSlot.classList.remove('is-rotating');
          rotationSlot.offsetWidth;
          rotationSlot.classList.remove('is-resetting');
          scheduleRotation(2800);
        }, 450);
      }, delay);
    }

    function scheduleStatementRotation(delay) {
      window.clearTimeout(statementTimer);
      if (motionQuery.matches || document.hidden || !statementSlot) return;

      statementTimer = window.setTimeout(function () {
        var nextIndex = (statementIndex + 1) % statementWords.length;
        incomingStatementWord.textContent = statementWords[nextIndex];
        statementSlot.classList.add('is-rotating');

        statementTimer = window.setTimeout(function () {
          statementIndex = nextIndex;
          currentStatementWord.textContent = statementWords[statementIndex];
          incomingStatementWord.textContent = statementWords[(statementIndex + 1) % statementWords.length];
          statementSlot.classList.add('is-resetting');
          statementSlot.classList.remove('is-rotating');
          statementSlot.offsetWidth;
          statementSlot.classList.remove('is-resetting');
          scheduleStatementRotation(3000);
        }, 450);
      }, delay);
    }

    function revealGroup(group, staggerChildren) {
      if (!group) return;

      group.classList.add('motion-reveal');
      if (!staggerChildren) return;

      Array.prototype.forEach.call(group.querySelectorAll(staggerChildren), function (item, index) {
        item.classList.add('motion-reveal-item');
        item.style.setProperty('--reveal-delay', String(index * 100) + 'ms');
      });
    }

    function showRevealGroup(group) {
      group.classList.add('is-visible');
      Array.prototype.forEach.call(group.querySelectorAll('.motion-reveal-item'), function (item) {
        item.classList.add('is-visible');
      });
    }

    function buildScrollReveals() {
      revealGroup(document.querySelector('.feature-strip'), '.strip-item');
      revealGroup(document.querySelector('.statement'));
      revealGroup(document.querySelector('.contact'), '.contact-item');
      revealGroup(document.querySelector('.site-footer'));

      var groups = document.querySelectorAll('.motion-reveal');
      if (motionQuery.matches || !('IntersectionObserver' in window)) {
        Array.prototype.forEach.call(groups, showRevealGroup);
        return;
      }

      page.classList.add('motion-ready');
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          showRevealGroup(entry.target);
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.15 });

      Array.prototype.forEach.call(groups, function (group) {
        revealObserver.observe(group);
      });
    }

    function revealEverything() {
      page.classList.remove('motion-ready');
      if (revealObserver) {
        revealObserver.disconnect();
        revealObserver = null;
      }
      Array.prototype.forEach.call(document.querySelectorAll('.motion-reveal'), showRevealGroup);
    }

    function handleMotionPreference() {
      if (motionQuery.matches) {
        clearRotation();
        clearStatementRotation();
        revealEverything();
        return;
      }
      scheduleRotation(2800);
      scheduleStatementRotation(1800);
    }

    buildPhraseRotation();
    buildStatementRotation();
    buildScrollReveals();
    handleMotionPreference();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        window.clearTimeout(rotationTimer);
        rotationTimer = 0;
        window.clearTimeout(statementTimer);
        statementTimer = 0;
        return;
      }
      scheduleRotation(1000);
      scheduleStatementRotation(1700);
    });

    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', handleMotionPreference);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(handleMotionPreference);
    }
  });
}());
