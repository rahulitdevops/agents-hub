"use client";

/**
 * TaskBoard — Kanban-style drag-and-drop task board.
 *
 * Uses @dnd-kit for drag-and-drop between columns:
 *   - Queued (slate) → Running (blue) → Completed (green) → Failed (red)
 *
 * On drop between columns, optimistically updates state then PATCHes API.
 */

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/lib/types";

// ─── Column Config ───────────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; label: string; color: string; bg: string; dot: string }[] = [
  { id: "queued", label: "Queued", color: "text-slate-600", bg: "bg-slate-50", dot: "bg-slate-400" },
  { id: "parked", label: "Parked", color: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-400" },
  { id: "running", label: "Running", color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
  { id: "completed", label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  { id: "failed", label: "Failed", color: "text-red-600", bg: "bg-red-50", dot: "bg-red-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-slate-100 text-slate-500 border-slate-200",
};

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-xl p-3 shadow-sm transition-all",
        isDragging && "shadow-lg shadow-brand-500/10 border-brand-300 rotate-2 scale-105"
      )}
    >
      {/* Task input / title */}
      <p className="text-sm text-slate-900 font-medium line-clamp-2">{task.input}</p>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-2">
        {/* Agent pill */}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 truncate max-w-[120px]">
          {task.agentName}
        </span>
        {/* Priority badge */}
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", PRIORITY_COLORS[task.priority] || "")}>
          {task.priority}
        </span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
        <span className="font-mono">{task.duration}</span>
        {task.tokensUsed > 0 && <span>{task.tokensUsed.toLocaleString()} tokens</span>}
      </div>
    </div>
  );
}

// ─── Sortable Task Card Wrapper ──────────────────────────────────────────────

function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} />
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────────────────────

function Column({
  column,
  tasks,
}: {
  column: (typeof COLUMNS)[0];
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-w-[280px] flex-1">
      {/* Column header */}
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl mb-3", column.bg)}>
        <span className={cn("w-2 h-2 rounded-full", column.dot)} />
        <span className={cn("text-sm font-semibold", column.color)}>{column.label}</span>
        <span className="ml-auto text-xs text-slate-400 font-medium">{tasks.length}</span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-[200px] p-2 rounded-xl border-2 border-dashed transition-colors",
          isOver
            ? "border-brand-400 bg-brand-50/50"
            : "border-transparent"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-slate-400">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Board ──────────────────────────────────────────────────────────────

interface TaskBoardProps {
  tasks: Task[];
  onTaskUpdate: (id: string, status: TaskStatus) => void;
}

export function TaskBoard({ tasks, onTaskUpdate }: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) setActiveTask(task);
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Determine target column
      const targetColumn = COLUMNS.find((c) => c.id === overId);
      if (!targetColumn) {
        // Dropped on another task — find which column that task is in
        const targetTask = tasks.find((t) => t.id === overId);
        if (!targetTask) return;
        const currentTask = tasks.find((t) => t.id === taskId);
        if (!currentTask || currentTask.status === targetTask.status) return;
        onTaskUpdate(taskId, targetTask.status);
        return;
      }

      // Dropped on a column directly
      const currentTask = tasks.find((t) => t.id === taskId);
      if (!currentTask || currentTask.status === targetColumn.id) return;
      onTaskUpdate(taskId, targetColumn.id);
    },
    [tasks, onTaskUpdate]
  );

  // Group tasks by column
  const grouped = COLUMNS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id);
    return acc;
  }, {});

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <Column key={col.id} column={col} tasks={grouped[col.id] || []} />
        ))}
      </div>

      {/* Drag overlay — shows a floating copy of the card being dragged */}
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
