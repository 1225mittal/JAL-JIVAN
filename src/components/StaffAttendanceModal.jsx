import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  UserCheck,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  CheckCircle2,
  Users,
  Building2,
  ExternalLink,
  Flame,
  Loader2
} from 'lucide-react';
import { fetchAllStaffAttendance, fetchStoreSettings, defaultStoreSettings } from '../lib/supabase';

export default function StaffAttendanceModal({ isOpen, onClose, drivers = [] }) {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [storeHub, setStoreHub] = useState(defaultStoreSettings);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const [records, settings] = await Promise.all([
        fetchAllStaffAttendance(),
        fetchStoreSettings()
      ]);
      setAttendanceRecords(records || []);
      if (settings) setStoreHub(settings);
    } catch (err) {
      console.warn('Failed to load staff attendance in admin modal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAttendance();
    }
  }, [isOpen]);

  // Map drivers by ID for quick lookup of name and phone
  const driverMap = useMemo(() => {
    const map = {};
    drivers.forEach((d) => {
      map[d.id] = d;
    });
    return map;
  }, [drivers]);

  // Today's attendance summary for all drivers
  const todayStats = useMemo(() => {
    const presentDriverIds = new Set();
    attendanceRecords.forEach((r) => {
      if (r.created_at && r.created_at.startsWith(todayStr)) {
        presentDriverIds.add(r.driver_id);
      }
    });

    const presentCount = presentDriverIds.size;
    const totalDrivers = drivers.length;
    return {
      presentCount,
      totalDrivers,
      absentCount: Math.max(0, totalDrivers - presentCount)
    };
  }, [attendanceRecords, drivers, todayStr]);

  // Filtered attendance records list
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      const driver = driverMap[record.driver_id] || record.drivers || {};
      const driverName = (driver.name || '').toLowerCase();
      const driverPhone = (driver.phone || '').toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query || driverName.includes(query) || driverPhone.includes(query);
      const matchesDriver =
        selectedDriverId === 'all' || record.driver_id === selectedDriverId;

      return matchesSearch && matchesDriver;
    });
  }, [attendanceRecords, driverMap, searchQuery, selectedDriverId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-scale-up">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Staff Attendance Management Hub</h3>
              <p className="text-xs text-slate-400">
                Track delivery boys GPS check-in times and geofence verification logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAttendance}
              title="Refresh Attendance"
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Attendance Summary KPIs */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 grid grid-cols-3 gap-3 shrink-0">
          <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Present Today</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {todayStats.presentCount} <span className="text-xs font-normal text-slate-400">/ {todayStats.totalDrivers} staff</span>
              </p>
            </div>
            <UserCheck className="w-7 h-7 text-emerald-400 opacity-80" />
          </div>

          <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pending Check-In</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {todayStats.absentCount} <span className="text-xs font-normal text-slate-400">staff</span>
              </p>
            </div>
            <Clock className="w-7 h-7 text-amber-400 opacity-80" />
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Store Hub Geofence</p>
              <p className="text-xs font-bold text-white mt-1 truncate max-w-[150px]">
                {storeHub.store_name}
              </p>
              <p className="text-[10px] text-emerald-400 font-mono">Radius: {storeHub.radius_meters}m</p>
            </div>
            <Building2 className="w-7 h-7 text-cyan-400 opacity-80" />
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by driver name or phone..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 whitespace-nowrap">Filter Driver:</span>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Delivery Boys</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.phone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable Records Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Fetching staff attendance records...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-white font-bold text-sm">No attendance records found</p>
              <p className="text-xs text-slate-400">
                Attendance records logged by delivery boys via store geofence will appear here.
              </p>
            </div>
          ) : (
            filteredRecords.map((record) => {
              const driver = driverMap[record.driver_id] || record.drivers || { name: 'Staff Rider', phone: '' };
              const dateObj = new Date(record.created_at);
              const isToday = record.created_at && record.created_at.startsWith(todayStr);

              const formattedDate = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                : 'Date N/A';
              const formattedTime = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Time N/A';

              const lat = Number(record.check_in_lat);
              const lng = Number(record.check_in_lng);
              const hasCoords = !isNaN(lat) && !isNaN(lng);

              return (
                <div key={record.id} className="p-4 hover:bg-slate-850 transition flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {driver.name ? driver.name.charAt(0).toUpperCase() : 'D'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{driver.name || 'Delivery Boy'}</span>
                        {isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Present Today
                          </span>
                        )}
                        <span className="text-slate-500 font-mono text-[11px]">{driver.phone}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-1 flex-wrap">
                        <span>Check-In: <strong className="text-slate-200">{formattedDate} at {formattedTime}</strong></span>
                        <span>•</span>
                        <span>Hub Geofence Verified</span>
                        {hasCoords && (
                          <>
                            <span>•</span>
                            <a
                              href={`https://www.google.com/maps?q=${lat},${lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
