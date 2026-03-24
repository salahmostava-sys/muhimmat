const { supabaseAdmin } = require("../config/supabase");
const { asyncHandler } = require("../utils/asyncHandler");

const WORK_START_TIME = process.env.ATTENDANCE_WORK_START_TIME || "09:00:00";
const WORK_END_TIME = process.env.ATTENDANCE_WORK_END_TIME || "18:00:00";

function toTimeString(date) {
  return date.toTimeString().slice(0, 8);
}

function toSeconds(timeText) {
  const [h, m, s] = String(timeText || "00:00:00").split(":").map((v) => Number(v) || 0);
  return (h * 3600) + (m * 60) + s;
}

function roundHours(seconds) {
  return Math.round((seconds / 3600) * 100) / 100;
}

const checkIn = asyncHandler(async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) {
    return res.status(400).json({ message: "employee_id is required" });
  }
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const checkInTime = toTimeString(now);
  const late = toSeconds(checkInTime) > toSeconds(WORK_START_TIME);

  const payload = {
    employee_id,
    date,
    check_in: checkInTime,
    status: "present",
    late,
  };

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .upsert(payload, { onConflict: "employee_id,date" })
    .select()
    .single();
  if (error) throw error;
  res.status(201).json(data);
});

const checkOut = asyncHandler(async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) {
    return res.status(400).json({ message: "employee_id is required" });
  }
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const checkOutTime = toTimeString(now);

  const { data: current, error: findError } = await supabaseAdmin
    .from("attendance")
    .select("check_in")
    .eq("employee_id", employee_id)
    .eq("date", date)
    .maybeSingle();
  if (findError) throw findError;
  if (!current?.check_in) {
    return res.status(404).json({ message: "No check-in found for today" });
  }

  const checkInSeconds = toSeconds(current.check_in);
  const checkOutSeconds = toSeconds(checkOutTime);
  const workedSeconds = Math.max(0, checkOutSeconds - checkInSeconds);
  const total_hours = roundHours(workedSeconds);
  const early_leave = checkOutSeconds < toSeconds(WORK_END_TIME);

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .update({
      check_out: checkOutTime,
      total_hours,
      early_leave,
    })
    .eq("employee_id", employee_id)
    .eq("date", date)
    .select()
    .single();
  if (error) throw error;
  res.json(data);
});

const getAttendanceByEmployee = asyncHandler(async (req, res) => {
  const { employee } = req.params;
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("employee_id", employee)
    .order("date", { ascending: false });
  if (error) throw error;
  res.json(data || []);
});

module.exports = { checkIn, checkOut, getAttendanceByEmployee };
