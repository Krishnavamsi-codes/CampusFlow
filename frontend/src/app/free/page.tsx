"use client";

import { useEffect, useState } from "react";
import { api, RoomStatus } from "../../utils/api";
import RoomCard from "../../components/RoomCard";
import BottomNav from "../../components/BottomNav";
import { Zap, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function FreeNowPage() {
  const [freeRooms, setFreeRooms] = useState<RoomStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryDate, setQueryDate] = useState("");
  const [queryTime, setQueryTime] = useState("");

  const loadFreeRooms = async (dateVal?: string, timeVal?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getFreeRooms(dateVal, timeVal);
      setFreeRooms(data.freeRooms);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to fetch current free rooms.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize clock/date parameters
  useEffect(() => {
    const d = new Date();
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(d.getTime() + tzOffset);

    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;
    const formattedTime = `${hours}:${minutes}`;

    setQueryDate(formattedDate);
    setQueryTime(formattedTime);

    loadFreeRooms(formattedDate, formattedTime);
  }, []);

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Zap className="text-emerald-400 fill-emerald-400/10 pulse-dot-free rounded-full" size={22} />
            Free Rooms Now
          </h1>
          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Empty rooms sorted by longest availability</p>
        </div>

        <button
          onClick={() => loadFreeRooms(queryDate, queryTime)}
          className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-white transition-all active:scale-95 shadow-md backdrop-blur-sm"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin text-emerald-400" : ""} />
        </button>
      </header>

      {/* Main List */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} className="h-36 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 bg-[#121214] border border-zinc-800 rounded-2xl text-center shadow-lg">
          <p className="text-xs text-zinc-400 font-semibold">{error}</p>
        </div>
      ) : freeRooms.length === 0 ? (
        <div className="p-8 glass border border-zinc-800/80 rounded-3xl text-center flex flex-col items-center justify-center shadow-lg">
          <AlertCircle className="text-zinc-500 mb-3" size={28} />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">All Rooms Occupied</h3>
          <p className="text-xs text-zinc-500 mt-1 font-medium">There are no free classrooms at the moment.</p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05
              }
            }
          }}
          className="grid grid-cols-2 gap-3"
        >
          {freeRooms.map((room) => (
            <motion.div
              key={`free-${room.roomId}`}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 25 } }
              }}
            >
              <RoomCard room={room} dateStr={queryDate} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
}
