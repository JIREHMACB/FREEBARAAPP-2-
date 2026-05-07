import React from 'react';

type Props = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: Props) {

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <img
        src="/logo.png"
        alt="Logo"
        className="w-32 h-32 animate-pulse"
      />
    </div>
  );
}