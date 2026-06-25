import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const MONTHLY_LIMIT = 4;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const today = new Date();
  const currentMonthIndex = today.getMonth();
  const currentYear = today.getFullYear();
  const currentMonthName = monthNames[currentMonthIndex];
  const nextMonthIndex = (currentMonthIndex + 1) % 12;
  const nextMonthYear = nextMonthIndex === 0 ? currentYear + 1 : currentYear;
  const nextMonthName = monthNames[nextMonthIndex];

  const saved = JSON.parse(localStorage.getItem("leaveData")) || [];
  const [leaveRequests, setLeaveRequests] = useState(saved);

  useEffect(() => {
    localStorage.setItem("leaveData", JSON.stringify(leaveRequests));
  }, [leaveRequests]);
  const [filter, setFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(-1);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [emergencyConfirm, setEmergencyConfirm] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  };

  const [formData, setFormData] = useState({
    employee: "",
    contact: "",
    leaveType: "",
    fromDate: "",
    toDate: "",
    reason: "",
  });

  const calculateDays = (fromDate, toDate) => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getEffectiveLimit = (employee, month, year) => {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;

    const emergencyDeductions = leaveRequests.filter(leave => {
      const leaveMonth = new Date(leave.fromDate).getMonth();
      const leaveYear = new Date(leave.fromDate).getFullYear();
      return leave.employee.toLowerCase() === employee.toLowerCase() &&
        leaveMonth === prevMonth &&
        leaveYear === prevYear &&
        leave.status === "Approved" &&
        leave.emergencyDays > 0;
    }).reduce((total, leave) => total + leave.emergencyDays, 0);

    return MONTHLY_LIMIT - emergencyDeductions;
  };

  const getMonthlyUsage = (employee, month, year) => {
    return leaveRequests.filter(leave => {
      const leaveMonth = new Date(leave.fromDate).getMonth();
      const leaveYear = new Date(leave.fromDate).getFullYear();
      return leave.employee.toLowerCase() === employee.toLowerCase() &&
        leaveMonth === month &&
        leaveYear === year;
    }).reduce((total, leave) => total + leave.leaveDays, 0);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const applyLeave = (e) => {
    e.preventDefault();

    const leaveDays = calculateDays(formData.fromDate, formData.toDate);
    const month = new Date(formData.fromDate).getMonth();
    const year = new Date(formData.fromDate).getFullYear();

    const effectiveLimit = getEffectiveLimit(formData.employee, month, year);
    const usedDays = getMonthlyUsage(formData.employee, month, year);
    const totalDays = usedDays + leaveDays;
    const remaining = effectiveLimit - usedDays;

    if (totalDays > effectiveLimit) {
      const excessDays = totalDays - effectiveLimit;

      if (excessDays > 1) {
        showToast(`You can only exceed your ${effectiveLimit}-day limit by 1 emergency day.`, "error");
        return;
      }

      const nextBal = MONTHLY_LIMIT - excessDays;
      setEmergencyConfirm({
        employee: formData.employee,
        leaveDays,
        emergencyDays: excessDays,
        nextMonthBalance: nextBal,
        nextMonthDeduction: "Pending",
        status: "Pending",
        formData: { ...formData },
      });
      return;
    }

    let emergencyDays = 0;
    let nextMonthBalance = MONTHLY_LIMIT;

    const newLeave = {
      id: Date.now(),
      ...formData,
      leaveDays,
      emergencyDays,
      nextMonthBalance,
      nextMonthDeduction: "Pending",
      status: "Pending",
    };

    setLeaveRequests([...leaveRequests, newLeave]);
    showToast("Leave applied successfully!", "success");

    setFormData({
      employee: "",
      contact: "",
      leaveType: "",
      fromDate: "",
      toDate: "",
      reason: "",
    });
  };

  const confirmEmergencyLeave = () => {
    const leave = {
      id: Date.now(),
      ...emergencyConfirm.formData,
      leaveDays: emergencyConfirm.leaveDays,
      emergencyDays: emergencyConfirm.emergencyDays,
      nextMonthBalance: emergencyConfirm.nextMonthBalance,
      nextMonthDeduction: "Pending",
      status: "Pending",
    };
    setLeaveRequests([...leaveRequests, leave]);
    showToast(`Emergency leave applied! ${emergencyConfirm.nextMonthBalance} days available next month.`, "warning");
    setEmergencyConfirm(null);
    setFormData({
      employee: "",
      contact: "",
      leaveType: "",
      fromDate: "",
      toDate: "",
      reason: "",
    });
  };

  const updateStatus = (id, status) => {
    setConfirm({ id, status });
  };

  const confirmAction = () => {
    setLeaveRequests(
      leaveRequests.map((leave) => {
        if (leave.id === confirm.id) {
          return {
            ...leave,
            status: confirm.status,
            nextMonthDeduction:
              confirm.status === "Approved" && leave.emergencyDays > 0 ? "Yes" : "No",
          };
        }
        return leave;
      })
    );
    showToast(`Leave ${confirm.status.toLowerCase()} successfully!`, confirm.status === "Approved" ? "success" : "error");
    setConfirm(null);
  };

  const filteredLeaves = leaveRequests.filter((leave) => {
    const leaveMonth = new Date(leave.fromDate).getMonth();
    const leaveYear = new Date(leave.fromDate).getFullYear();
    const matchesFilter = leave.employee.toLowerCase().includes(filter.toLowerCase());
    const matchesMonth = selectedMonth === -1 || (leaveMonth === selectedMonth && leaveYear === currentYear);
    return matchesFilter && matchesMonth;
  });

  const totalLeavesTaken = leaveRequests.reduce((total, leave) => total + leave.leaveDays, 0);
  const approvedLeaves = leaveRequests.filter((leave) => leave.status === "Approved").length;
  const rejectedLeaves = leaveRequests.filter((leave) => leave.status === "Rejected").length;
  const pendingLeaves = leaveRequests.filter((leave) => leave.status === "Pending").length;

  const employees = [...new Set(leaveRequests.map(l => l.employee))];

  return (
    <div className="container">
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : toast.type === "warning" ? "!" : "i"}
          </span>
          {toast.message}
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">
              {confirm.status === "Approved" ? "✅" : "❌"}
            </div>
            <h3>Confirm {confirm.status}</h3>
            <p>Are you sure you want to <strong>{confirm.status.toLowerCase()}</strong> this leave request?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`btn-confirm-${confirm.status.toLowerCase()}`} onClick={confirmAction}>
                {confirm.status}
              </button>
            </div>
          </div>
        </div>
      )}

      {emergencyConfirm && (
        <div className="modal-overlay" onClick={() => setEmergencyConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h3>Emergency Leave</h3>
            <p>
              You are exceeding the monthly limit of <strong>{MONTHLY_LIMIT} days</strong>.<br /><br />
              This will use <strong>{emergencyConfirm.emergencyDays} emergency day(s)</strong> and reduce
              <strong> {emergencyConfirm.nextMonthBalance} days</strong> from {nextMonthName}'s balance.<br /><br />
              Do you want to continue?
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEmergencyConfirm(null)}>Cancel</button>
              <button className="btn-confirm-approved" onClick={confirmEmergencyLeave}>
                Yes, Use Emergency Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-brand">
          <div className="header-logo">A</div>
          <div>
            <h1>Leave Management System</h1>
            <p className="header-subtitle">Accenture HR Portal</p>
          </div>
        </div>
        <div className="header-month">
          <div className="header-month-item">
            <span className="header-month-label">Current</span>
            <span className="header-month-value">{currentMonthName} {currentYear}</span>
          </div>
          <div className="header-month-divider"></div>
          <div className="header-month-item">
            <span className="header-month-label">Next</span>
            <span className="header-month-value">{nextMonthName} {nextMonthYear}</span>
          </div>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalLeavesTaken}</span>
            <span className="stat-label">Total Leaves Taken</span>
          </div>
        </div>
        <div className="stat-card stat-approved">
          <div className="stat-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{approvedLeaves}</span>
            <span className="stat-label">Approved</span>
          </div>
        </div>
        <div className="stat-card stat-pending">
          <div className="stat-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{pendingLeaves}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
        <div className="stat-card stat-rejected">
          <div className="stat-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{rejectedLeaves}</span>
            <span className="stat-label">Rejected</span>
          </div>
        </div>
      </div>

      {employees.map(emp => {
        const monthlyUsage = getMonthlyUsage(emp, currentMonthIndex, currentYear);
        const effectiveLimit = getEffectiveLimit(emp, currentMonthIndex, currentYear);
        const nextLimit = getEffectiveLimit(emp, nextMonthIndex, nextMonthYear);
        const usagePercent = effectiveLimit > 0 ? (monthlyUsage / effectiveLimit) * 100 : 100;
        const remaining = effectiveLimit - monthlyUsage;
        return (
          <div className="card employee-card" key={emp}>
            <div className="employee-card-header">
              <div className="employee-name-section">
                <div className="employee-avatar">{emp.charAt(0).toUpperCase()}</div>
                <div>
                  <h2>{emp}</h2>
                  <span className="employee-subtitle">{monthNames[currentMonthIndex]} Overview</span>
                </div>
              </div>
              <span className={`status-badge ${remaining <= 0 ? 'badge-exceeded' : remaining <= 1 ? 'badge-low' : 'badge-good'}`}>
                {remaining <= 0 ? 'No days left' : `${remaining} day${remaining > 1 ? 's' : ''} left`}
              </span>
            </div>
            <div className="employee-stats">
              <div className="employee-stat">
                <div className="stat-header-row">
                  <span className="stat-title">{currentMonthName} Usage</span>
                  <span className="stat-numbers">{monthlyUsage} / {effectiveLimit} days</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="employee-stat">
                <div className="stat-header-row">
                  <span className="stat-title">{nextMonthName} Available Balance</span>
                  <span className="stat-numbers">{nextLimit} days</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill next"
                    style={{ width: `${(nextLimit / MONTHLY_LIMIT) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="content-grid">
        <div className="card">
          <h2>Apply Leave</h2>
          <form onSubmit={applyLeave} className="leave-form">
            <div className="form-row">
              <div className="form-group">
                <label>Employee Name</label>
                <input
                  type="text"
                  name="employee"
                  placeholder="e.g. John Doe"
                  value={formData.employee}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="tel"
                  name="contact"
                  placeholder="e.g. 1234567890"
                  value={formData.contact}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Leave Type</label>
                <select name="leaveType" value={formData.leaveType} onChange={handleChange} required>
                  <option value="">Select type</option>
                  <option>Sick Leave</option>
                  <option>Personal Leave</option>
                  <option>Emergency Leave</option>
                </select>
              </div>
              <div className="form-group">
                <label>From Date</label>
                <input type="date" name="fromDate" value={formData.fromDate} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>To Date</label>
                <input type="date" name="toDate" value={formData.toDate} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea name="reason" placeholder="Enter reason for leave" value={formData.reason} onChange={handleChange} required />
              </div>
            </div>
            <button type="submit" className="btn-submit">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Apply Leave
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Company Rules</h2>
          <ul className="rules-list">
            <li><span className="rule-bullet rules-work">W</span> 1 Year = 365 Working Days</li>
            <li><span className="rule-bullet rules-limit">L</span> Monthly Leave Limit = 4 Days</li>
            <li><span className="rule-bullet rules-sick">S</span> Employees Can Apply Sick Leave</li>
            <li><span className="rule-bullet rules-personal">P</span> Employees Can Apply Personal Leave</li>
            <li><span className="rule-bullet rules-emergency">E</span> Emergency Leave After Monthly Limit</li>
            <li><span className="rule-bullet rules-one">1</span> Only 1 Emergency Day Per Month</li>
            <li><span className="rule-bullet rules-deduct">D</span> Emergency Leave Reduces Next Month</li>
            <li><span className="rule-bullet rules-safe">R</span> Rejected Leave Has No Penalty</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="history-header">
          <h2>Leave History</h2>
          <div className="filter-controls">
            <div className="search-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                placeholder="Search employee..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              <option value={-1}>All Months</option>
              {monthNames.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Contact</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Emergency</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Next Cut</th>
                <th>Next Bal</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length > 0 ? (
                filteredLeaves.map((leave, idx) => (
                  <tr key={leave.id} style={{ animationDelay: `${idx * 0.03}s` }}>
                    <td className="td-employee">{leave.employee}</td>
                    <td>{leave.contact}</td>
                    <td><span className="type-badge">{leave.leaveType}</span></td>
                    <td>{new Date(leave.fromDate).toLocaleDateString("en-GB")}</td>
                    <td>{new Date(leave.toDate).toLocaleDateString("en-GB")}</td>
                    <td className="td-days">{leave.leaveDays}</td>
                    <td>{leave.emergencyDays > 0 ? leave.emergencyDays : "-"}</td>
                    <td className="td-reason" title={leave.reason}>
                      {leave.reason.length > 12 ? leave.reason.slice(0, 12) + ".." : leave.reason}
                    </td>
                    <td>
                      <span className={`status-tag status-${leave.status.toLowerCase()}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td>{leave.nextMonthDeduction}</td>
                    <td>{leave.nextMonthBalance}</td>
                    <td className="td-actions">
                      {leave.status === "Pending" ? (
                        <>
                          <button className="btn-sm btn-sm-approve" onClick={() => updateStatus(leave.id, "Approved")}>Approve</button>
                          <button className="btn-sm btn-sm-reject" onClick={() => updateStatus(leave.id, "Rejected")}>Reject</button>
                        </>
                      ) : (
                        <span className="status-done">{leave.status}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="12">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" width="48" height="48" stroke="#94a3b8" strokeWidth="1.5" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      <p>No leave records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
