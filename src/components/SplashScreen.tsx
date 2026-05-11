import React from 'react';

type Props = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: Props) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
      }}
    >
      {/* LOGO */}
      <img
        src="/logo.png"
        alt="FreeBara"
        style={{
          width: 'auto',
          height: '80px',
          objectFit: 'contain',
          animation: 'splashPulse 1.5s ease-in-out infinite',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/logo.png';
        }}
      />

      {/* LOADING BAR */}
      <div
        style={{
          marginTop: 32,
          width: 120,
          height: 3,
          borderRadius: 999,
          backgroundColor: '#e2e8f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 999,
            backgroundColor: '#155be3',
            animation: 'splashLoadbar 2.5s ease-in-out forwards',
          }}
        />
      </div>

      {/* ANIMATIONS */}
      <style>{`
        @keyframes splashPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.97); }
        }

        @keyframes splashLoadbar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}