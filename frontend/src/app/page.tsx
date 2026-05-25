"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { api, RoomStatus, GroupedRooms } from "../utils/api";
import RoomCard from "../components/RoomCard";
import BottomNav from "../components/BottomNav";
import { Search, RotateCw, Clock, Flame, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const [groupedRooms, setGroupedRooms] = useState<GroupedRooms | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Clean IST Date/Time for API queries
  const [queryDate, setQueryDate] = useState("");
  const [queryTime, setQueryTime] = useState("");

  // Live Digital Clock (IST)
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      // Adjust to IST (UTC +5:30)
      const tzOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(d.getTime() + tzOffset);

      const hours = String(istTime.getUTCHours()).padStart(2, '0');
      const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
      const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);

      const day = istTime.getUTCDate();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[istTime.getUTCMonth()];
      const year = istTime.getUTCFullYear();
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = daysOfWeek[istTime.getUTCDay()];
      setCurrentDate(`${dayName}, ${day} ${month} ${year}`);

      // API formatted values (only update query params once every minute to reduce fetches)
      const qMonth = String(istTime.getUTCMonth() + 1).padStart(2, '0');
      const qDay = String(istTime.getUTCDate()).padStart(2, '0');
      setQueryDate(`${year}-${qMonth}-${qDay}`);
      setQueryTime(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Rooms
  const fetchRooms = async (dateVal?: string, timeVal?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getRooms(dateVal, timeVal);
      setGroupedRooms(data.groupedRooms);
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to fetch room availability. Make sure the API server is active.");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger fetch when query parameters are initialized
  useEffect(() => {
    if (queryDate && queryTime) {
      fetchRooms(queryDate, queryTime);
    }
  }, [queryDate, queryTime]);

  // Compute immediate list of Free Now rooms for horizontal slider
  const freeNowRooms = useMemo(() => {
    if (!groupedRooms) return [];
    const all = [
      ...groupedRooms.G_ROOMS,
      ...groupedRooms.B_ROOMS,
      ...groupedRooms.FIRST_FLOOR,
    ];
    return all
      .filter((r) => r.status === "FREE")
      .sort((a, b) => (b.freeDurationMinutes || 0) - (a.freeDurationMinutes || 0));
  }, [groupedRooms]);

  // Filtered rooms logic
  const filterRooms = useCallback((roomsList: RoomStatus[]) => {
    if (!searchQuery) return roomsList;
    const query = searchQuery.toLowerCase().trim();
    return roomsList.filter(
      (r) =>
        r.roomName.toLowerCase().includes(query) ||
        r.roomId.toLowerCase().includes(query) ||
        (r.ongoingClass && r.ongoingClass.course.toLowerCase().includes(query)) ||
        (r.nextClass && r.nextClass.course.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  const filteredGroupedRooms = useMemo(() => {
    if (!groupedRooms) return null;
    return {
      G_ROOMS: filterRooms(groupedRooms.G_ROOMS),
      B_ROOMS: filterRooms(groupedRooms.B_ROOMS),
      FIRST_FLOOR: filterRooms(groupedRooms.FIRST_FLOOR),
    };
  }, [groupedRooms, filterRooms]);

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      {/* Header section */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-1.5 leading-none">
            <span className="text-emerald-500">IIITS</span> Live Rooms
          </h1>
          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Campus Room Schedule Intelligence</p>
        </div>
        <button
          onClick={() => fetchRooms(queryDate, queryTime)}
          className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-white transition-all active:scale-95 shadow-md backdrop-blur-sm"
        >
          <RotateCw size={14} className={isLoading ? "animate-spin text-emerald-400" : ""} />
        </button>
      </header>

      {/* Clock Widget */}
      <div className="flex items-center justify-between p-4.5 rounded-3xl glass mb-6 shadow-2xl relative overflow-hidden border border-zinc-800/80">
        <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl relative flex items-center justify-center">
            <Clock size={18} className="relative z-10" />
            <span className="absolute inset-0 bg-emerald-500/20 rounded-2xl animate-ping opacity-25" />
          </div>
          <div>
            <div className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none">Campus Live Time</div>
            <div className="text-xl font-black text-white font-mono tracking-tight mt-1">{currentTime || "--:--:--"}</div>
          </div>
        </div>
        <div className="text-right relative z-10">
          <div className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none">Active Date</div>
          <div className="text-xs font-bold text-zinc-300 mt-1.5">{currentDate || "Loading date..."}</div>
        </div>
      </div>

      {/* Sticky Search Container with Backdrop Blur */}
      <div className="sticky top-0 z-40 bg-[#060608]/85 backdrop-blur-md -mx-4 px-4 py-3.5 border-b border-zinc-900/40 mb-6 transition-all">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Search classrooms, courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f0f12]/95 text-white border border-zinc-800/80 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/10 rounded-2xl py-3 pl-11 pr-4 text-xs outline-none transition-all placeholder:text-zinc-500 shadow-inner"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs mb-6 flex items-start gap-2.5">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Free Now horizontal slider (Visible when not loading and no search active) */}
      {!isLoading && !searchQuery && freeNowRooms.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <Flame size={15} className="text-emerald-500" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Free Now</h2>
            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 font-black">
              {freeNowRooms.length}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar snap-x scroll-smooth">
            {freeNowRooms.map((room, idx) => (
              <motion.div
                key={`freenow-${room.roomId}`}
                className="w-32 shrink-0 snap-start"
                whileTap={{ scale: 0.95 }}
                whileHover={{ y: -2 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, type: "spring", stiffness: 260, damping: 22 }}
              >
                <Link href={`/room/${room.roomId}?date=${queryDate}`}>
                  <div className="p-4 rounded-2xl text-center glow-free transition-all duration-300 border border-emerald-500/15">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Room</span>
                    <span className="text-lg font-black text-white block mt-0.5">{room.roomName.split(" ")[0]}</span>
                    <span className="block text-[9px] text-emerald-400 font-extrabold mt-2.5 uppercase tracking-wide truncate bg-emerald-500/10 py-1 px-1.5 rounded-lg border border-emerald-500/10">
                      {room.freeDurationMinutes && room.freeDurationMinutes >= 300
                        ? "Rest of day"
                        : room.freeDurationMinutes
                        ? `${Math.floor(room.freeDurationMinutes / 60)}h ${room.freeDurationMinutes % 60}m`
                        : "FREE"}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Main categories */}
      {isLoading ? (
        <div className="space-y-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="space-y-4">
              <div className="h-3 bg-zinc-800 rounded w-20 animate-pulse ml-1" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-36 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl animate-pulse" />
                <div className="h-36 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl animate-pulse" />
              </div>
            </div>
          ))}
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
                staggerChildren: 0.08
              }
            }
          }}
          className="space-y-8"
        >
          {filteredGroupedRooms && (
            <>
              {/* G Rooms Section */}
              {filteredGroupedRooms.G_ROOMS.length > 0 && (
                <motion.section
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 25 } }
                  }}
                >
                  <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5 px-1">
                    <span className="w-1 h-1 bg-emerald-500/40 rounded-full" />
                    G Rooms
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredGroupedRooms.G_ROOMS.map((room) => (
                      <RoomCard key={room.roomId} room={room} dateStr={queryDate} />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* B Rooms Section */}
              {filteredGroupedRooms.B_ROOMS.length > 0 && (
                <motion.section
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 25 } }
                  }}
                >
                  <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5 px-1">
                    <span className="w-1 h-1 bg-emerald-500/40 rounded-full" />
                    B Rooms
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredGroupedRooms.B_ROOMS.map((room) => (
                      <RoomCard key={room.roomId} room={room} dateStr={queryDate} />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* First Floor Section */}
              {filteredGroupedRooms.FIRST_FLOOR.length > 0 && (
                <motion.section
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 25 } }
                  }}
                >
                  <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3.5 flex items-center gap-1.5 px-1">
                    <span className="w-1 h-1 bg-emerald-500/40 rounded-full" />
                    First Floor
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredGroupedRooms.FIRST_FLOOR.map((room) => (
                      <RoomCard key={room.roomId} room={room} dateStr={queryDate} />
                    ))}
                  </div>
                </motion.section>
              )}

              {filteredGroupedRooms.G_ROOMS.length === 0 &&
                filteredGroupedRooms.B_ROOMS.length === 0 &&
                filteredGroupedRooms.FIRST_FLOOR.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12 glass rounded-3xl p-6"
                  >
                    <p className="text-xs text-zinc-400 font-semibold">No classrooms match your search queries</p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-[10px] text-emerald-400 underline font-black uppercase tracking-wider mt-3"
                    >
                      Clear Search Filters
                    </button>
                  </motion.div>
                )}
            </>
          )}
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
}
