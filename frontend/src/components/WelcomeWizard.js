import React, { useState, useEffect } from 'react';
import './welcome-wizard.css';

export function WelcomeWizard({ slides, sessionKey = 'welcome_wizard_seen' }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState('forward');

  useEffect(() => {
    if (sessionStorage.getItem(sessionKey) !== '1') {
      setVisible(true);
    }
  }, [sessionKey]);

  function dismiss() {
    sessionStorage.setItem(sessionKey, '1');
    setVisible(false);
  }

  function goTo(next, dir) {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 220);
  }

  if (!visible) return null;

  const isLast = step === slides.length - 1;
  const isFirst = step === 0;
  const slide = slides[step];

  const slideAnimClass = animating
    ? direction === 'forward'
      ? 'ww-slide--exit-forward'
      : 'ww-slide--exit-back'
    : '';

  return (
    <>
      <div
        className="ww-backdrop"
        onClick={dismiss}
        aria-hidden="true"
      />
      <div className="ww-container">
        <div
          className="ww-card"
          role="dialog"
          aria-modal="true"
          aria-label={String(slides[0]?.headline ?? 'Welcome')}
          onClick={(e) => e.stopPropagation()}
        >
          {!isLast && (
            <div className="ww-skip-row">
              <button className="ww-skip-btn" onClick={dismiss}>
                Skip
              </button>
            </div>
          )}

          <div
            className={`ww-slide ${slideAnimClass} ${isLast ? 'ww-slide--first' : 'ww-slide--has-skip'}`}
          >
            {slide.visual}
            <h2 className="ww-headline">{slide.headline}</h2>
            <div className="ww-body">{slide.body}</div>
          </div>

          <div className="ww-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > step ? 'forward' : 'back')}
                className={`ww-dot ${i === step ? 'ww-dot--active' : 'ww-dot--inactive'}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <div className="ww-nav">
            <button
              className="ww-back-btn"
              onClick={() => goTo(step - 1, 'back')}
              disabled={isFirst}
            >
              ← Back
            </button>

            {isLast ? (
              <button className="ww-next-btn" onClick={dismiss}>
                Let&apos;s go
              </button>
            ) : (
              <button className="ww-next-btn" onClick={() => goTo(step + 1, 'forward')}>
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
