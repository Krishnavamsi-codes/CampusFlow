"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, RoomDetails, RawSchedule, RoomStatus, CRUser, getCRUserMeta, getAuthToken } from "../../../utils/api";
import BottomNav from "../../../components/BottomNav";
import { ArrowLeft, Calendar, ShieldAlert, RefreshCw, Move, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RoomDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCrLoggedIn, setIsCrLoggedIn] = useState(false);
  const [crMeta, setCrMeta] = useState<CRUser | null>(null);

  // Modal / Drawer state for Moving a class
  const [selectedScheduleForMove, setSelectedScheduleForMove] = useState<RawSchedule | null>(null);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [targetRoomInput, setTargetRoomInput] = useState("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  const queryDate = searchParams.get("date") || (() => {
    const d = new Date();
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(d.getTime() + tzOffset);
    return `${istTime.getUTCFullYear()}-${String(istTime.getUTCMonth() + 1).padStart(2, '0')}-${String(istTime.getUTCDate()).padStart(2, '0')}`;
  })();

  const fetchRoomDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getRoomDetails(roomId, queryDate);
      setDetails(data);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to fetch room details";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, queryDate]);

  // Fetch available rooms for moving reference
  const fetchAvailableRooms = useCallback(async () => {
    try {
      const data = await api.getRooms(queryDate);
      const rooms: string[] = [];
      const values = Object.values(data.groupedRooms) as RoomStatus[][];
      values.forEach((list) => {
        list.forEach((r) => {
          if (r.roomId !== roomId) {
            rooms.push(r.roomId);
          }
        });
      });
      setAvailableRooms(rooms);
    } catch (err) {
      console.error("Failed to load reference rooms", err);
    }
  }, [roomId, queryDate]);

  useEffect(() => {
    fetchRoomDetails();
    fetchAvailableRooms();

    // Check CR user auth status
    const token = getAuthToken();
    const meta = getCRUserMeta();
    if (token && meta) {
      setIsCrLoggedIn(true);
      setCrMeta(meta);
    }
  }, [roomId, queryDate, fetchRoomDetails, fetchAvailableRooms]);

  // Helper: check if logged-in CR can override this schedule
  const canOverride = (schedule: { batch: string; section: number }) => {
    if (!isCrLoggedIn || !crMeta) return false;
    return crMeta.batch === schedule.batch && crMeta.section === schedule.section;
  };

  // Action: Cancel Class
  const handleCancelClass = async (scheduleId: string) => {
    if (!window.confirm("Are you sure you want to cancel this class for today?")) return;
    setIsSubmittingOverride(true);
    try {
      await api.cancelClass(scheduleId, queryDate);
      alert("Class cancelled successfully for today!");
      fetchRoomDetails();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel class";
      alert(message);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Action: Move Class Submit
  const handleMoveClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleForMove || !targetRoomInput) return;

    setIsSubmittingOverride(true);
    try {
      await api.moveClass(selectedScheduleForMove.id, queryDate, targetRoomInput);
      alert(`Class moved successfully to ${targetRoomInput}!`);
      setSelectedScheduleForMove(null);
      setTargetRoomInput("");
      fetchRoomDetails();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to move class";
      alert(message);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const isFree = details?.status === "FREE";

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-all text-xs font-semibold py-2.5 px-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl active:scale-95 shadow-sm"
        >
          <ArrowLeft size={13} /> Back
        </button>

        <h1 className="text-sm font-black text-white tracking-widest uppercase">Room Details</h1>

        <button
          onClick={fetchRoomDetails}
          className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin text-emerald-400" : ""} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="h-32 bg-zinc-900/60 border border-zinc-800/80 rounded-3xl animate-pulse" />
          <div className="h-72 bg-zinc-900/60 border border-zinc-800/80 rounded-3xl animate-pulse" />
        </div>
      ) : error || !details ? (
        <div className="p-6 glass border border-zinc-800/80 rounded-3xl text-center shadow-lg">
          <p className="text-xs text-zinc-400 font-semibold">{error || "Failed to load room details"}</p>
          <button
            onClick={() => router.push("/")}
            className="text-[10px] text-emerald-400 font-black uppercase tracking-wider underline mt-4 inline-block"
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Status Display Panel */}
          <div
            className={`p-6 rounded-3xl border relative overflow-hidden shadow-2xl ${
              isFree ? "glow-free" : "glow-occupied"
            }`}
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-full blur-xl" />

            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black block">Classroom Room</span>
                <h2 className="text-3xl font-black text-white mt-1 leading-none">{details.roomName}</h2>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isFree
                    ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/5 text-rose-400 border-rose-500/20"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFree ? "bg-emerald-400 pulse-dot-free" : "bg-rose-400 pulse-dot-occupied"
                  }`}
                />
                {isFree ? "FREE NOW" : "BUSY"}
              </div>
            </div>

            {/* Status explanation */}
            <div className="mt-8">
              {isFree ? (
                <div>
                  <div className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Next Occupancy</div>
                  <div className="text-white font-extrabold text-lg mt-1 tracking-tight">
                    {details.nextClass ? (
                      <span>
                        Free until {details.nextClass.startTime} ({details.nextClass.course}
                        {details.nextClass.section})
                      </span>
                    ) : (
                      <span>Free for the rest of the day</span>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Ongoing Lecture</div>
                  <div className="text-white font-extrabold text-lg mt-1 tracking-tight">
                    {details.ongoingClass?.course}
                    {details.ongoingClass?.section} <span className="text-zinc-400 text-sm font-semibold">({details.ongoingClass?.batch})</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-1.5 font-medium">
                    Running till <span className="text-rose-350 font-bold">{details.ongoingClass?.endTime}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Section */}
          <div className="p-6 bg-[#0f0f12] border border-zinc-850 rounded-3xl shadow-xl">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Calendar size={13} className="text-emerald-500" /> Daily Availability Schedule
            </h3>

            {/* Scrollable vertical timeline wrapper */}
            <div className="relative pl-10 space-y-8">
              {/* Connector connecting line */}
              <div className="timeline-line" />

              {(() => {
                const parseTimeToMinutes = (timeStr: string) => {
                  const [h, m] = timeStr.split(":").map(Number);
                  return h * 60 + m;
                };

                const getIstMinutesNow = () => {
                  const d = new Date();
                  const tzOffset = 5.5 * 60 * 60 * 1000;
                  const istTime = new Date(d.getTime() + tzOffset);
                  return istTime.getUTCHours() * 60 + istTime.getUTCMinutes();
                };

                const nowMins = getIstMinutesNow();

                return details.timeline.map((slot, index) => {
                  const isSlotFree = slot.status === "FREE";
                  const startMins = parseTimeToMinutes(slot.startTime);
                  const endMins = parseTimeToMinutes(slot.endTime);
                  const isCurrentActive = nowMins >= startMins && nowMins < endMins;

                  // Try to find if there is a corresponding raw schedule database record
                  // that matches this slot time (to let CR edit it)
                  const schedRecord = details.rawSchedules.find(
                    (s) => s.startTime === slot.startTime && s.endTime === slot.endTime && `${s.course}${s.section}` === slot.label
                  );

                  const isMovableOrCancellable = schedRecord && canOverride(schedRecord);

                  return (
                    <motion.div
                      key={`timeline-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="relative flex flex-col items-start"
                    >
                      {/* Circle Node Indicator */}
                      <div
                        className={`absolute -left-[30px] top-1.5 w-5 h-5 rounded-full border-4 z-10 flex items-center justify-center transition-all duration-300 ${
                          isCurrentActive
                            ? isSlotFree
                              ? "bg-[#060608] border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110"
                              : "bg-[#060608] border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] scale-110"
                            : isSlotFree
                            ? "bg-[#060608] border-emerald-500/40"
                            : "bg-[#060608] border-rose-500/40"
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${isSlotFree ? "bg-emerald-500" : "bg-rose-500"}`} />
                      </div>

                      {/* Timeline Node Card */}
                      <div
                        className={`w-full p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                          isCurrentActive
                            ? isSlotFree
                              ? "bg-zinc-900/40 border-emerald-500/40 shadow-[0_4px_20px_rgba(16,185,129,0.08)]"
                              : "bg-zinc-900/40 border-rose-500/40 shadow-[0_4px_20px_rgba(244,63,94,0.08)]"
                            : isSlotFree
                            ? "bg-zinc-950/20 border-zinc-900 hover:border-emerald-500/10"
                            : "bg-zinc-950/20 border-zinc-900 hover:border-rose-500/10"
                        }`}
                      >
                        {isCurrentActive && (
                          <div className={`absolute right-0 top-0 h-full w-1 flex flex-col ${isSlotFree ? "bg-emerald-500" : "bg-rose-500"}`} />
                        )}

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-500 font-mono font-bold block">
                                {slot.startTime} - {slot.endTime}
                              </span>
                              {isCurrentActive && (
                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                  isSlotFree ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20" : "bg-rose-500/10 text-rose-450 border border-rose-500/20"
                                }`}>
                                  Live Now
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-sm font-black block mt-1.5 ${
                                isSlotFree ? "text-emerald-400" : "text-white"
                              }`}
                            >
                              {isSlotFree ? "FREE" : slot.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {slot.isMovedIn && (
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md text-[8px] font-black uppercase tracking-wider">
                                Redirected In
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Display CR Actions if CR is logged in and owns this schedule */}
                        {isMovableOrCancellable && (
                          <div className="mt-4 pt-3 border-t border-zinc-900/60 flex items-center gap-3">
                            <button
                              onClick={() => handleCancelClass(schedRecord.id)}
                              disabled={isSubmittingOverride}
                              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-400 border border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl py-2 px-3.5 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <Ban size={10} /> Cancel Today
                            </button>

                            <button
                              onClick={() => setSelectedScheduleForMove(schedRecord)}
                              disabled={isSubmittingOverride}
                              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-indigo-400 border border-indigo-500/25 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-xl py-2 px-3.5 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <Move size={10} /> Move Room
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Active Overrides indicator if any exist */}
          {(details.rawSchedules.some(s => s.overrides.length > 0) || details.movedInSchedules.length > 0) && (
            <div className="p-4.5 bg-indigo-500/5 border border-indigo-500/15 rounded-3xl flex items-start gap-3 shadow-md">
              <ShieldAlert className="text-indigo-400 shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Active Schedule Modifications</h4>
                <div className="text-[11px] text-zinc-400 space-y-1.5 mt-2 font-medium">
                  {details.rawSchedules.flatMap(s => s.overrides).map(o => (
                    <div key={o.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      <span>Class cancelled/moved out ({o.type})</span>
                    </div>
                  ))}
                  {details.movedInSchedules.map(m => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      <span>Class {m.schedule.course}{m.schedule.section} redirected into this room for today</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Move Class Modal Sheet */}
      <AnimatePresence>
        {selectedScheduleForMove && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedScheduleForMove(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            />

            {/* Slide up sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0c0c0f] border-t border-zinc-800 rounded-t-[2.5rem] p-7 z-50 pb-10 shadow-[0_-15px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />

              <h3 className="text-lg font-black text-white leading-none">
                Redirect Lecture: {selectedScheduleForMove.course}
                {selectedScheduleForMove.section}
              </h3>
              <p className="text-xs text-zinc-400 mt-2 font-medium">
                Temporarily move this class to a different room today.
              </p>

              <form onSubmit={handleMoveClassSubmit} className="mt-6 space-y-5">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2 px-1">
                    Select Target Room
                  </label>
                  <select
                    value={targetRoomInput}
                    onChange={(e) => setTargetRoomInput(e.target.value)}
                    required
                    className="w-full bg-[#121215] border border-zinc-800 text-white focus:border-emerald-500/60 rounded-xl p-3 text-xs outline-none transition-all"
                  >
                    <option value="">-- Choose a Classroom --</option>
                    {availableRooms.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedScheduleForMove(null)}
                    className="flex-1 py-3.5 px-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs font-bold text-zinc-400 active:scale-95 transition-all text-center"
                  >
                    Dismiss
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingOverride || !targetRoomInput}
                    className="flex-1 py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-650 text-xs font-black text-black active:scale-95 transition-all text-center shadow-lg"
                  >
                    {isSubmittingOverride ? "Redirecting..." : "Confirm Redirect"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
