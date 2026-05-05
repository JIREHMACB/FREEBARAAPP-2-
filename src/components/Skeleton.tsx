import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export const Skeleton = ({ className = '', variant = 'rect' }: SkeletonProps) => {
  const baseClass = "bg-slate-200 relative overflow-hidden";
  const variantClass = variant === 'circle' ? "rounded-full" : variant === 'text' ? "rounded-md h-4" : "rounded-2xl";

  return (
    <div className={`${baseClass} ${variantClass} ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "linear",
        }}
      />
    </div>
  );
};

export const PostSkeleton = () => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton variant="circle" className="w-10 h-10" />
      <div className="space-y-2 flex-1">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="text" className="w-1/4" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
    <Skeleton className="w-full aspect-video" />
    <div className="flex justify-between pt-2">
      <Skeleton variant="text" className="w-16" />
      <Skeleton variant="text" className="w-16" />
      <Skeleton variant="text" className="w-16" />
    </div>
  </div>
);

export const PannelSkeleton = () => (
  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
    <div className="flex items-start gap-4">
      <Skeleton variant="rect" className="w-12 h-12 rounded-2xl" />
      <div className="space-y-2 flex-1">
        <Skeleton variant="text" className="w-2/3" />
        <Skeleton variant="text" className="w-1/3" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
      <Skeleton variant="text" className="w-12" />
      <Skeleton variant="rect" className="w-20 h-8 rounded-xl" />
    </div>
  </div>
);
