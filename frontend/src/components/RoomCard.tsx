"use client";

import Link from "next/link";
import { RoomStatus } from "../utils/api";
import { CheckCircle2, XCircle, ArrowRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface RoomCardProps {
  room: RoomStatus;
  dateStr?: string;
}

export default function RoomCard({ room, dateStr }: RoomCardProps) {
  const isFree = room.status === "FREE";

  // Helper to format free duration
  const formatFreeDuration = (mins: number | null) => {
    if (mins === null) return "";
    if (mins >= 300) return "rest of day";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  return (
    <Link href={`/room/${room.roomId}${dateStr ? `?date=${dateStr}` : ""}`}>
      <motion.div
        whileTap={{ scale: 0.96 }}
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 min-h-[160px] cursor-pointer shadow-lg group ${
          isFree ? "glow-free" : "glow-occupied"
        }`}
      >
        {/* Top Section: Room ID and Status Pill */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-white font-sans leading-none">{room.roomName.split(" ")[0]}</h3>
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1 block">
              {room.category === "G_ROOMS"
                ? "G-Floor G"
                : room.category === "B_ROOMS"
                ? "G-Floor B"
                : "1st Floor"}
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              isFree
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.05)]"
                : "bg-rose-500/5 text-rose-400 border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.05)]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isFree ? "bg-emerald-400 pulse-dot-free" : "bg-rose-400 pulse-dot-occupied"
              }`}
            />
            {isFree ? "FREE" : "BUSY"}
          </div>
        </div>

        {/* Middle Section: Main details (ongoing class or free duration) */}
        <div className="mt-4">
          {isFree ? (
            <div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-base tracking-tight">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>Free Now</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                Available for <span className="text-emerald-300 font-bold">{formatFreeDuration(room.freeDurationMinutes)}</span>
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 text-rose-400 font-extrabold text-base tracking-tight">
                <XCircle size={16} className="shrink-0" />
                <span className="truncate max-w-[150px]">
                  {room.ongoingClass?.course}
                  {room.ongoingClass?.section}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                Occupied till <span className="text-rose-300 font-bold">{room.ongoingClass?.endTime}</span>
                {room.ongoingClass?.isMovedIn && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-[8px] font-black tracking-wider uppercase">
                    MOVED
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Section: Next class info */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-medium">
          {room.nextClass ? (
            <div className="flex items-center gap-1 truncate max-w-[85%]">
              <Calendar size={11} className="text-zinc-600 shrink-0" />
              <span>Next:</span>
              <span className="font-bold text-zinc-300 truncate">
                {room.nextClass.course}
                {room.nextClass.section}
              </span>
              <span className="text-zinc-600">@</span>
              <span className="font-bold text-zinc-300">{room.nextClass.startTime}</span>
              {room.nextClass.isMovedIn && (
                <span className="text-[8px] text-indigo-400 font-black uppercase tracking-wider">(M)</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Calendar size={11} className="text-zinc-600 shrink-0" />
              <span className="text-zinc-500">No classes remaining</span>
            </div>
          )}
          <ArrowRight size={11} className="text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-zinc-300" />
        </div>
      </motion.div>
    </Link>
  );
}
