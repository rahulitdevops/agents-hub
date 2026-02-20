"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-slate-200 rounded-lg animate-pulse",
        className
      )}
      style={style}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <Skeleton className="w-10 h-10 rounded-xl mb-3" />
      <Skeleton className="w-20 h-7 mb-2" />
      <Skeleton className="w-24 h-4" />
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="w-32 h-5 mb-1.5" />
          <Skeleton className="w-48 h-3" />
        </div>
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="w-16 h-8 rounded-lg" />
        <Skeleton className="w-20 h-8 rounded-lg" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-48 h-8 rounded-lg" />
      </div>
      <div className="flex items-end gap-1 h-[300px] pt-4">
        {[...Array(30)].map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${Math.random() * 60 + 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          <Skeleton className="w-16 h-4 rounded" />
          <div className="flex-1">
            <Skeleton className="w-3/4 h-4 mb-1.5" />
            <Skeleton className="w-24 h-3" />
          </div>
          <Skeleton className="w-12 h-4" />
        </div>
      ))}
    </div>
  );
}
