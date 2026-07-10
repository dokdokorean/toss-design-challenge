import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function MeetingDetails() {
  const { key } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState(null);
  const [copied, setCopied] = useState(false);

  // Database save feedback toast states
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Interactive drawer states
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Selected duration filter in 30-min block count (default: 1 block = 30 mins)
  const [meetingDuration, setMeetingDuration] = useState(1);
  // Currently highlighted recommendation slot: { col, startSlot, duration } or null
  const [selectedRecommendedSlot, setSelectedRecommendedSlot] = useState(null);
  // Trade-off yellow border flash animation trigger state
  const [tradeOffFlash, setTradeOffFlash] = useState(false);

  // States for input editor & warning toast
  const [isDurationEditing, setIsDurationEditing] = useState(false);
  const [durationInputVal, setDurationInputVal] = useState("");
  const [showWarningToast, setShowWarningToast] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  // State to control if the trade-off block warning box has been dismissed
  const [showTradeOff, setShowTradeOff] = useState(true);
  // State to trigger the slide-up closing animation
  const [isTradeOffClosing, setIsTradeOffClosing] = useState(false);

  useEffect(() => {
    if (tradeOffFlash) {
      const timer = setTimeout(() => {
        setTradeOffFlash(false);
      }, 5000); // Reset after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [tradeOffFlash]);
  // Object mapping slot strings 'colValue_timeStr' to their state: 'red' | 'green' | 'yellow'
  const [selectedSlots, setSelectedSlots] = useState({});

  // Timetable 2D drag states
  const [isSlotDragging, setIsSlotDragging] = useState(false);
  const [slotDragStart, setSlotDragStart] = useState(null); // { col, slot }
  const [slotDragMode, setSlotDragMode] = useState(null); // target state: 'red' | 'green' | 'yellow'
  const [slotDragStartSnapshot, setSlotDragStartSnapshot] = useState({}); // snap before drag

  // Heatmap tooltip hover state
  const [heatmapTooltip, setHeatmapTooltip] = useState(null); // { col, slot, x, y, prefVoters, possVoters, unavailVoters }

  // Default month for calendar display (July 2026 for consistency, or dynamically parsed from dates)
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 6, 1));

  // Weekdays abbreviations for calendar grid
  const calendarWeekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekdayOptions = ['월', '화', '수', '목', '금', '토', '일'];

  // Sanitization helper to assign IDs to legacy meeting participants who don't have them
  const sanitizeMeetingData = (data) => {
    if (data && data.participants) {
      data.participants = data.participants.map((p, idx) => {
        if (!p.id) {
          return { ...p, id: `legacy-${idx}-${p.name}` };
        }
        return p;
      });
    }
    return data;
  };

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const docRef = doc(db, 'meetings', key);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = sanitizeMeetingData(docSnap.data());

          // Merge local cache availabilities to protect offline local test data
          const localDataStr = localStorage.getItem(`meeting-${key}`);
          if (localDataStr) {
            const localData = sanitizeMeetingData(JSON.parse(localDataStr));
            if (localData.availabilities) {
              data.availabilities = {
                ...(localData.availabilities || {}),
                ...(data.availabilities || {})
              };
            }
          }

          setMeeting(data);
          if (data.preferredDuration) {
            setMeetingDuration(data.preferredDuration);
          }

          // If there are specific dates, set currentMonth to the first selected date's month
          if (data.dateType === 'specific' && data.selectedDates && data.selectedDates.length > 0) {
            const firstDate = new Date(data.selectedDates[0]);
            if (!isNaN(firstDate.getTime())) {
              setCurrentMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
            }
          }
        } else {
          // Document not found in Firestore. Try local fallback first.
          const localDataStr = localStorage.getItem(`meeting-${key}`);
          if (localDataStr) {
            const data = sanitizeMeetingData(JSON.parse(localDataStr));
            setMeeting(data);
            if (data.preferredDuration) {
              setMeetingDuration(data.preferredDuration);
            }
            if (data.dateType === 'specific' && data.selectedDates && data.selectedDates.length > 0) {
              const firstDate = new Date(data.selectedDates[0]);
              if (!isNaN(firstDate.getTime())) {
                setCurrentMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
              }
            }
          } else {
            setMeeting(null);
          }
        }
      } catch (error) {
        console.warn("Firestore fetch failed. Checking client-side localStorage fallback: ", error);

        // Try localStorage fallback on error as well
        const localDataStr = localStorage.getItem(`meeting-${key}`);
        if (localDataStr) {
          const data = sanitizeMeetingData(JSON.parse(localDataStr));
          setMeeting(data);
          if (data.preferredDuration) {
            setMeetingDuration(data.preferredDuration);
          }
          if (data.dateType === 'specific' && data.selectedDates && data.selectedDates.length > 0) {
            const firstDate = new Date(data.selectedDates[0]);
            if (!isNaN(firstDate.getTime())) {
              setCurrentMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
            }
          }
        } else {
          // Fallback for local-only demo (mock data based on key)
          setMeeting(sanitizeMeetingData({
            title: "디자인 워크숍 (Demo)",
            participants: [
              { name: "최진우", attendance: "required" },
              { name: "이민우", attendance: "required" },
              { name: "김지선", attendance: "optional" }
            ],
            startTime: "10:00",
            endTime: "16:00",
            dateType: "specific",
            selectedDates: ["2026-07-06", "2026-07-07", "2026-07-08"],
            selectedDays: [],
            availabilities: {}
          }));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMeeting();
  }, [key]);

  // Global mouseup listener to stop all drag selections
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsSlotDragging(false);
      setSlotDragStart(null);
      setSlotDragMode(null);
      setSlotDragStartSnapshot({});
    };

    const handleGlobalClick = (e) => {
      // If clicking anything that is not a rank card, not inside a rank card, and not the slider/controls, clear the recommendation highlight
      if (
        !e.target.closest('.rank-card') &&
        !e.target.closest('.duration-filter-row') &&
        !e.target.closest('.participant-row-static') &&
        !e.target.closest('.sliding-drawer') &&
        !e.target.closest('.share-copy-btn')
      ) {
        setSelectedRecommendedSlot(null);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Copy link handler
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Participant click triggers drawer and loads existing selected slots by their ID (fallback to name)
  const handleParticipantClick = (p) => {
    setSelectedParticipant(p);
    const existing = (meeting.availabilities && (meeting.availabilities[p.id] || meeting.availabilities[p.name])) || {};
    setSelectedSlots(typeof existing === 'object' && !Array.isArray(existing) ? existing : {});
  };

  // Duration change handler: Update state, localstorage, and save directly to database
  const handleDurationChange = async (newVal) => {
    setMeetingDuration(newVal);
    setSelectedRecommendedSlot(null); // Reset highlight when slider duration changes
    if (!meeting) return;

    const updatedMeeting = {
      ...meeting,
      preferredDuration: newVal
    };

    // Update local state immediately
    setMeeting(updatedMeeting);
    localStorage.setItem(`meeting-${key}`, JSON.stringify(updatedMeeting));

    try {
      await setDoc(doc(db, 'meetings', key), updatedMeeting);
    } catch (err) {
      console.warn("Could not save preferredDuration to Firestore database: ", err);
    }
  };

  const handleSubmitAvailability = async () => {
    if (!selectedParticipant) return;
    // Ensure that if no slots are color-selected manually, we record the empty state (fully 'red')
    // by filling all slots with 'red' so it's not treated as an empty/unsubmitted voter object.
    const finalSlots = { ...selectedSlots };
    if (Object.keys(finalSlots).length === 0) {
      columns.forEach(col => {
        timeSlots.forEach(slot => {
          finalSlots[getSlotKey(col, slot)] = 'red';
        });
      });
    }

    const updatedAvailabilities = {
      ...(meeting.availabilities || {}),
      [selectedParticipant.id]: finalSlots
    };

    const updatedMeeting = {
      ...meeting,
      availabilities: updatedAvailabilities
    };

    // Update local state immediately for instant UX feedback
    setMeeting(updatedMeeting);

    // Save back to localStorage as fallback
    localStorage.setItem(`meeting-${key}`, JSON.stringify(updatedMeeting));

    // Close drawer
    setSelectedParticipant(null);
    setSelectedSlots({});

    try {
      // Save back to Firestore (Awaited to confirm database storage!)
      await setDoc(doc(db, 'meetings', key), updatedMeeting);

      setToastMessage("응답이 기록되었습니다!");
      setShowFeedbackToast(true);
      setTimeout(() => setShowFeedbackToast(false), 2500);
    } catch (err) {
      console.warn("Could not save availability to Firestore database: ", err);

      // Fallback feedback
      setToastMessage("서버 저장 실패: 일정이 기기에 임시 저장되었습니다.");
      setShowFeedbackToast(true);
      setTimeout(() => setShowFeedbackToast(false), 3500);
    }
  };

  // Calculate 30-minute slots based on meeting startTime & endTime
  const getTimetableSlots = () => {
    if (!meeting) return [];
    const start = meeting.startTime || "09:00";
    const end = meeting.endTime || "18:00";

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMins = startHour * 60 + startMin;
    const endMins = endHour * 60 + endMin;

    const slots = [];
    for (let m = startMins; m < endMins; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    return slots;
  };

  // Format date columns for specific dates: "2026-07-06" -> "7/6 (월)"
  const formatColumnLabel = (col) => {
    if (meeting.dateType === 'specific') {
      const parts = col.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1]);
        const d = parseInt(parts[2]);
        const dateObj = new Date(col);
        const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
        const dow = daysOfWeek[dateObj.getDay()];
        return `${m}/${d} (${dow})`;
      }
      return col;
    }
    return col; // returns '월', '화' etc.
  };

  // Timetable 2D grid drag-selection logic
  const getSlotKey = (col, slot) => `${col}_${slot}`;

  const handleSlotMouseDown = (col, slot, e) => {
    e.preventDefault(); // Stop text highlight during drag
    setIsSlotDragging(true);
    setSlotDragStart({ col, slot });

    const keyStr = getSlotKey(col, slot);
    const currentVal = selectedSlots[keyStr] || 'red';

    // Cycle rule: red -> green -> yellow -> red
    let nextVal = 'green';
    if (currentVal === 'green') {
      nextVal = 'yellow';
    } else if (currentVal === 'yellow') {
      nextVal = 'red';
    }

    setSlotDragMode(nextVal);
    setSlotDragStartSnapshot(selectedSlots);

    setSelectedSlots(prev => ({
      ...prev,
      [keyStr]: nextVal
    }));
  };

  const handleSlotMouseEnter = (col, slot) => {
    if (isSlotDragging && slotDragStart && slotDragMode) {
      const columns = meeting.dateType === 'specific' ? meeting.selectedDates : meeting.selectedDays;
      const slots = getTimetableSlots();

      const startColIdx = columns.indexOf(slotDragStart.col);
      const endColIdx = columns.indexOf(col);
      const startSlotIdx = slots.indexOf(slotDragStart.slot);
      const endSlotIdx = slots.indexOf(slot);

      if (startColIdx === -1 || endColIdx === -1 || startSlotIdx === -1 || endSlotIdx === -1) return;

      const minColIdx = Math.min(startColIdx, endColIdx);
      const maxColIdx = Math.max(startColIdx, endColIdx);
      const minSlotIdx = Math.min(startSlotIdx, endSlotIdx);
      const maxSlotIdx = Math.max(startSlotIdx, endSlotIdx);

      const dragRangeKeys = [];
      for (let c = minColIdx; c <= maxColIdx; c++) {
        for (let s = minSlotIdx; s <= maxSlotIdx; s++) {
          dragRangeKeys.push(getSlotKey(columns[c], slots[s]));
        }
      }

      setSelectedSlots(() => {
        const nextSlots = { ...slotDragStartSnapshot };
        dragRangeKeys.forEach(k => {
          nextSlots[k] = slotDragMode;
        });
        return nextSlots;
      });
    }
  };

  // Helper to generate calendar days matrix
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevMonthNum = month === 0 ? 11 : month - 1;
      const prevYearNum = month === 0 ? year - 1 : year;
      const dNum = prevTotalDays - i;
      days.push({
        dayNum: dNum,
        isCurrentMonth: false,
        dateStr: `${prevYearNum}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`
      });
    }

    // Days of current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        dayNum: i,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    // Leading days from next month
    const totalCells = days.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthNum = month === 11 ? 0 : month + 1;
      const nextYearNum = month === 11 ? year + 1 : year;
      days.push({
        dayNum: i,
        isCurrentMonth: false,
        dateStr: `${nextYearNum}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    return days;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>회의 상세를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="not-found-screen">
        <h2>회의를 찾을 수 없습니다</h2>
        <p>회의 코드가 올바르지 않거나 이미 만료된 회의방입니다.</p>
        <button className="create-meeting-btn" onClick={() => navigate('/')}>
          새 회의 만들기
        </button>
      </div>
    );
  }

  const calendarDays = generateCalendarDays();
  const columns = meeting.dateType === 'specific' ? meeting.selectedDates : meeting.selectedDays;
  const timeSlots = getTimetableSlots();

  const getEndTimeLabel = (startIndex, duration) => {
    const targetIndex = startIndex + duration;
    if (targetIndex < timeSlots.length) {
      return timeSlots[targetIndex];
    }
    return meeting.endTime || "18:00";
  };

  const handleConfirmTime = async (item) => {
    const endLabel = getEndTimeLabel(item.slotIndex, meetingDuration);
    const timeText = item.isGrouped
      ? `${formatColumnLabel(item.col)} ${item.startSlot} ~ ${item.endSlot}사이`
      : `${formatColumnLabel(item.col)} ${item.startSlot} ~ ${endLabel}`;

    const updatedMeeting = {
      ...meeting,
      confirmedTime: timeText
    };

    setMeeting(updatedMeeting);
    localStorage.setItem(`meeting-${key}`, JSON.stringify(updatedMeeting));

    try {
      await setDoc(doc(db, 'meetings', key), updatedMeeting);
      setToastMessage(`회의 일정이 ${timeText}로 확정되었습니다!`);
      setShowFeedbackToast(true);
      setTimeout(() => setShowFeedbackToast(false), 3000);
    } catch (err) {
      console.warn("Could not save confirmed time to Firestore: ", err);
      setToastMessage("서버 저장 실패: 기기에만 임시 저장되었습니다.");
      setShowFeedbackToast(true);
      setTimeout(() => setShowFeedbackToast(false), 3000);
    }
  };

  // Check if any participant has completed voting using ID or Name (if their availability object exists at all)
  const hasAnySubmission = meeting.availabilities &&
    Object.keys(meeting.availabilities).some(voterKey => {
      const slots = meeting.availabilities[voterKey];
      return slots && typeof slots === 'object' && Object.keys(slots).length > 0;
    });

  // Get list of participants who have submitted availability
  const voters = meeting && meeting.availabilities
    ? Object.keys(meeting.availabilities).filter(voterKey => {
      const slots = meeting.availabilities[voterKey];
      return slots && typeof slots === 'object' && Object.keys(slots).length > 0;
    })
    : [];
  const votersCount = voters.length;
  const hasAnyOptional = meeting && meeting.participants
    ? meeting.participants.some(p => p.attendance === 'optional')
    : false;

  return (
    <>
      {/* Heatmap Cell Hover Tooltip (Toss-style white card) */}
      {heatmapTooltip && (
        <div
          style={{
            position: 'fixed',
            left: `${heatmapTooltip.x}px`,
            top: heatmapTooltip.position === 'below'
              ? `${heatmapTooltip.y + heatmapTooltip.height + 10}px`
              : `${heatmapTooltip.y - 10}px`,
            transform: heatmapTooltip.position === 'below'
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
            zIndex: 99999,
            pointerEvents: 'none',
            backgroundColor: '#ffffff',
            border: '1px solid #f2f4f6',
            borderRadius: '16px',
            padding: '14px 16px',
            minWidth: '180px',
            maxWidth: '260px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            color: '#191f28',
            fontSize: '0.78rem',
            lineHeight: '1.5',
            fontFamily: 'inherit'
          }}
        >
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            ...(heatmapTooltip.position === 'below'
              ? {
                top: '-6px',
                borderBottom: '6px solid #ffffff',
                borderTop: 'none'
              }
              : {
                bottom: '-6px',
                borderTop: '6px solid #ffffff',
                borderBottom: 'none'
              }),
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            filter: heatmapTooltip.position === 'below'
              ? 'drop-shadow(0 -1px 1px rgba(0,0,0,0.04))'
              : 'drop-shadow(0 1px 1px rgba(0,0,0,0.08))'
          }} />

          {/* Time Label */}
          <div style={{ fontWeight: '700', fontSize: '0.82rem', color: '#191f28', marginBottom: '10px', letterSpacing: '-0.01em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
            {formatColumnLabel(heatmapTooltip.col)} {heatmapTooltip.slot}
          </div>

          {/* Helper: render a voter row with icon */}
          {(() => {
            const VoterRow = ({ name, state }) => {
              const iconProps = state === 'green'
                ? { bg: 'rgba(16,185,129,0.1)', stroke: '#10b981', path: 'M20 6 9 17l-5-5' }
                : state === 'yellow'
                  ? { bg: 'rgba(245,158,11,0.1)', stroke: '#f59e0b', path: 'M12 5 L20 19 H4 Z' }
                  : { bg: 'rgba(239,68,68,0.08)', stroke: '#ef4444', path: 'M18 6 6 18M6 6l12 12' };
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#4e5968' }}>
                  <div style={{ width: '15px', height: '15px', borderRadius: '50%', backgroundColor: iconProps.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={iconProps.stroke} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d={iconProps.path} /></svg>
                  </div>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}님</span>
                </div>
              );
            };

            return (
              <>
                {/* 필수 참석자 */}
                {heatmapTooltip.reqVoters.length > 0 && (
                  <div style={{ marginBottom: heatmapTooltip.optVoters.length > 0 ? '10px' : '0' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: '600', color: '#8b95a1', marginBottom: '5px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>필수 참석자</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px 8px' }}>
                      {heatmapTooltip.reqVoters.map(v => <VoterRow key={v.name} name={v.name} state={v.state} />)}
                    </div>
                  </div>
                )}

                {/* 선택 참석자 */}
                {heatmapTooltip.optVoters.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: '600', color: '#8b95a1', marginBottom: '5px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>선택 참석자</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px 8px' }}>
                      {heatmapTooltip.optVoters.map(v => <VoterRow key={v.name} name={v.name} state={v.state} />)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <div className="split-container read-only-view">
        {/* Left Panel: Summary Header & Participants */}
        <div className={`left-panel ${selectedParticipant ? 'drawer-open' : ''}`}>
          <div className="modern-input-wrapper">
            <div className="meeting-header">
              <h1 className="meeting-title-text">{meeting.title}</h1>
              <div className="meeting-share-container" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <span className="meeting-share-label" style={{ display: 'block', margin: 0 }}>응답자 초대하기</span>
                <div className="meeting-share-row" style={{ marginTop: 0, width: '100%', display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                  <span className="meeting-share-url" style={{ flex: 1, marginRight: '12px', textAlign: 'left' }}>{window.location.href}</span>
                  <button
                    type="button"
                    className="share-copy-btn"
                    onClick={handleCopyLink}
                    title={copied ? "복사완료" : "링크 복사하기"}
                  >
                    {copied ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        <span>복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        <span>링크 복사하기</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group margin-top-large">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <label className="meeting-share-label" style={{ display: 'block', margin: 0 }}>응답 기록하기</label>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3182F6' }}>
                  {votersCount === meeting.participants.length
                    ? `${votersCount}명 전원 응답 완료`
                    : `${votersCount}명 응답 완료`}
                </span>
              </div>
              <div className="participants-list read-only">
                {meeting.participants.map((p, index) => {
                  const targetAvailability = meeting.availabilities && (meeting.availabilities[p.id] || meeting.availabilities[p.name]);
                  const hasSubmitted = targetAvailability && typeof targetAvailability === 'object' && Object.keys(targetAvailability).length > 0;
                  return (
                    <div
                      key={p.id || index}
                      className={`participant-row-static clickable ${hasSubmitted ? 'submitted' : ''}`}
                      onClick={() => handleParticipantClick(p)}
                      title={hasSubmitted ? '작성된 가능한 시간 일정이 있습니다 (클릭하여 수정)' : '클릭하여 시간을 입력하세요'}
                    >
                      <div className="avatar-circle">
                        {p.name.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="participant-name-text">{p.name}님</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {hasSubmitted && <span className="attendance-badge submitted-badge">응답 완료</span>}
                        <span className={`attendance-badge ${p.attendance}`}>
                          {p.attendance === 'required' ? '필수 참여' : '선택 참여'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sliding Timetable Drawer */}
          <div className={`sliding-drawer ${selectedParticipant ? 'open' : ''}`}>
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="drawer-back-btn"
                  onClick={() => setSelectedParticipant(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <span className="drawer-title">
                  {selectedParticipant ? `${selectedParticipant.name}님의 가능한 시간 입력` : ''}
                </span>
              </div>
            </div>

            <div className="drawer-body">
              {/* Availability Color Legend */}
              <div className="timetable-legend">
                <div className="legend-item">
                  <span className="legend-color-box state-red"></span>
                  <span className="legend-label">회의 불가능해요</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color-box state-green"></span>
                  <span className="legend-label">회의 가능해요</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color-box state-yellow"></span>
                  <span className="legend-label">필요하면 시간 내볼게요</span>
                </div>
              </div>

              {/* Dynamic 30-minute Timetable Grid */}
              <div className="timetable-container" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="timetable-header-row" style={{ display: 'flex', width: '100%', marginBottom: '8px' }}>
                  <div className="timetable-time-cell" style={{ width: '50px', flexShrink: 0 }}></div>
                  <div style={{ display: 'flex', flex: 1, gap: '2px' }}>
                    {columns.map(col => (
                      <div key={col} className="timetable-header-cell" style={{ flex: 1, textAlign: 'center' }}>
                        {formatColumnLabel(col)}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
                  <div style={{
                    width: '50px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}>
                    {timeSlots.map((slot) => {
                      const showTimeLabel = slot.endsWith(':00');
                      return (
                        <div key={`label-${slot}`} style={{
                          height: '18px', // Reduced height to match cells
                          display: 'flex',
                          alignItems: 'flex-start', // Align to top edge
                          justifyContent: 'flex-end',
                          paddingRight: '8px',
                          boxSizing: 'border-box'
                        }}>
                          {showTimeLabel && (
                            <span className="time-label-text" style={{
                              fontSize: '0.78rem',
                              color: '#8b95a1',
                              fontWeight: '500',
                              transform: 'translateY(-50%)', // Shift up by half of its own height to align perfectly with the border line
                              display: 'inline-block'
                            }}>{slot}</span>
                          )}
                        </div>
                      );
                    })}

                    {/* Extra label for the very bottom edge boundary (end hour of the meeting) */}
                    {timeSlots.length > 0 && (() => {
                      // Calculate the end time of the last slot. 
                      // If the last slot is e.g. "17:30", the bottom edge corresponds to "18:00".
                      const lastSlot = timeSlots[timeSlots.length - 1];
                      const [hourStr, minStr] = lastSlot.split(':');
                      let endHour = Number(hourStr);
                      let endMin = '00';
                      if (minStr === '30') {
                        endHour += 1;
                      } else {
                        endMin = '30';
                      }
                      const finalLabel = `${String(endHour).padStart(2, '0')}:${endMin}`;

                      return (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          height: 0, // Zero height so it overlaps exactly on the bottom line
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '8px',
                          boxSizing: 'border-box'
                        }}>
                          <span className="time-label-text" style={{
                            fontSize: '0.78rem',
                            color: '#8b95a1',
                            fontWeight: '500',
                            transform: 'translateY(-50%)',
                            display: 'inline-block'
                          }}>{finalLabel}</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ display: 'flex', flex: 1, gap: '3px' }}>
                    {columns.map(col => (
                      <div
                        key={`col-box-${col}`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: '1px solid #e5e7eb',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {timeSlots.map((slot, slotIdx) => {
                          const keyStr = getSlotKey(col, slot);
                          const cellState = selectedSlots[keyStr] || 'red';

                          // Even index is XX:00 (bottom border of XX:00 is half-hourly, i.e., dotted)
                          // Odd index is XX:30 (bottom border of XX:30 is hourly, i.e., solid)
                          const isHourlyBoundary = slotIdx % 2 === 1;
                          const borderStyle = isHourlyBoundary ? '1px solid #e5e7eb' : '1px dotted #e5e7eb';
                          const isLastSlot = slotIdx === timeSlots.length - 1;

                          return (
                            <button
                              key={`${col}-${slot}`}
                              type="button"
                              className={`timetable-slot-btn state-${cellState}`}
                              onMouseDown={(e) => handleSlotMouseDown(col, slot, e)}
                              onMouseEnter={() => handleSlotMouseEnter(col, slot)}
                              title={`${formatColumnLabel(col)} ${slot}`}
                              style={{
                                width: '100%',
                                height: '18px', // Reduced height for more compact layout
                                border: 'none',
                                borderBottom: isLastSlot ? 'none' : borderStyle,
                                margin: 0,
                                padding: 0,
                                boxSizing: 'border-box'
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer with Submit button floating/sticky at bottom right */}
            <div className="drawer-footer" style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '16px',
              width: '100%',
              boxSizing: 'border-box',
              paddingLeft: '50px' // Align precisely with the start of the card columns (offsetting the 50px time labels column)
            }}>
              {(() => {
                const existing = selectedParticipant && meeting.availabilities &&
                  (meeting.availabilities[selectedParticipant.id] || meeting.availabilities[selectedParticipant.name]);

                // Compare selectedSlots with existing data
                let hasChanges = false;
                if (!existing) {
                  // If no existing data, changes exist if selectedSlots is not empty
                  // (or if they haven't submitted yet, they can submit an all-red empty configuration)
                  hasChanges = true;
                } else {
                  // If existing data, compare all grid cells (keys)
                  const allKeys = new Set([
                    ...Object.keys(existing),
                    ...Object.keys(selectedSlots)
                  ]);
                  for (let keyStr of allKeys) {
                    const val1 = existing[keyStr] || 'red';
                    const val2 = selectedSlots[keyStr] || 'red';
                    if (val1 !== val2) {
                      hasChanges = true;
                      break;
                    }
                  }
                }

                return (
                  <button
                    type="button"
                    className="create-meeting-btn"
                    onClick={handleSubmitAvailability}
                    disabled={!hasChanges}
                    style={{
                      padding: '12px 28px',
                      fontSize: '0.95rem',
                      opacity: hasChanges ? 1 : 0.45,
                      cursor: hasChanges ? 'pointer' : 'not-allowed',
                      backgroundColor: hasChanges ? '#3182F6' : '#e5e7eb',
                      color: hasChanges ? '#ffffff' : '#9ca3af',
                      borderColor: hasChanges ? '#3182F6' : '#e5e7eb',
                      boxShadow: hasChanges ? '0 4px 12px rgba(49, 130, 246, 0.15)' : 'none'
                    }}
                  >
                    {existing ? '수정하기' : '제출하기'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right Panel: Heatmap Schedule Coordination & Ranked Recommendations */}
        <div className="right-panel">
          <div className="modern-input-wrapper">
            <div className="meeting-header" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#191f28', margin: '0', letterSpacing: '-0.02em' }}>응답 결과</h2>
            </div>

            {meeting.confirmedTime && (
              <div style={{
                borderRadius: '24px',
                padding: '24px 20px',
                backgroundColor: '#ffffff',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.02)',
                width: '100%',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: '#E8F3FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3182F6',
                    flexShrink: 0
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#4e5968', letterSpacing: '-0.01em' }}>회의 일정이 확정되었어요</span>
                </div>
                <div style={{
                  fontSize: '1.45rem',
                  fontWeight: '800',
                  color: '#191f28',
                  letterSpacing: '-0.02em',
                  lineHeight: '1.3',
                  marginTop: '4px'
                }}>
                  {meeting.confirmedTime}
                </div>
              </div>
            )}

            {/* Read-Only Availability Heatmap Grid (Always Visible) */}
            <div className="form-group margin-top-large" style={{ marginTop: 0, marginBottom: 0 }}>
              {/* Outer card box wrapper for the timetable */}
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '20px',
                padding: '24px 20px',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
                width: '100%'
              }}>
                <div className="timetable-container" style={{ display: 'flex', flexDirection: 'column', height: 'auto', border: 'none', background: 'transparent', padding: 0 }}>
                  {/* Heatmap Timetable Header */}
                  <div className="timetable-header-row" style={{ display: 'flex', width: '100%', marginBottom: '8px' }}>
                    <div className="timetable-time-cell" style={{ width: '50px', flexShrink: 0 }}></div>
                    <div style={{ display: 'flex', flex: 1, gap: '2px' }}>
                      {columns.map(col => (
                        <div key={col} className="timetable-header-cell" style={{ flex: 1, textAlign: 'center' }}>
                          {formatColumnLabel(col)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Heatmap Body */}
                  <div style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
                    {/* Vertical Time Labels Column */}
                    <div style={{
                      width: '50px',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      {timeSlots.map((slot) => {
                        const showTimeLabel = slot.endsWith(':00');
                        return (
                          <div key={`heatmap-label-${slot}`} style={{
                            height: '18px', // Reduced height to match cells
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            boxSizing: 'border-box'
                          }}>
                            {showTimeLabel && (
                              <span className="time-label-text" style={{ fontSize: '0.78rem', color: '#8b95a1', fontWeight: '500', transform: 'translateY(-50%)', display: 'inline-block' }}>{slot}</span>
                            )}
                          </div>
                        );
                      })}

                      {/* Extra ending label for heatmap bottom line */}
                      {timeSlots.length > 0 && (() => {
                        const lastSlot = timeSlots[timeSlots.length - 1];
                        const [hourStr, minStr] = lastSlot.split(':');
                        let endHour = Number(hourStr);
                        let endMin = '00';
                        if (minStr === '30') {
                          endHour += 1;
                        } else {
                          endMin = '30';
                        }
                        const finalLabel = `${String(endHour).padStart(2, '0')}:${endMin}`;

                        return (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            height: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingRight: '8px',
                            boxSizing: 'border-box'
                          }}>
                            <span className="time-label-text" style={{ fontSize: '0.78rem', color: '#8b95a1', fontWeight: '500', transform: 'translateY(-50%)', display: 'inline-block' }}>{finalLabel}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Heatmap Column Cards */}
                    <div style={{ display: 'flex', flex: 1, gap: '3px' }}>
                      {columns.map(col => (
                        <div
                          key={`heatmap-col-${col}`}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#ffffff'
                          }}
                        >
                          {timeSlots.map((slot, slotIdx) => {
                            let prefCount = 0;
                            let possCount = 0;
                            let isAnyRequiredUnavailable = false;

                            voters.forEach(voterKey => {
                              const voterSlots = meeting.availabilities[voterKey] || {};
                              const state = voterSlots[getSlotKey(col, slot)] || 'red';
                              if (state === 'green') prefCount++;
                              if (state === 'yellow') possCount++;

                              const participant = meeting.participants
                                ? meeting.participants.find(p => p.id === voterKey || p.name === voterKey)
                                : null;
                              const attendance = participant ? (participant.attendance || 'required') : 'required';
                              if (attendance === 'required' && state === 'red') {
                                isAnyRequiredUnavailable = true;
                              }
                            });

                            const score = prefCount * 2 + possCount * 1;
                            const maxScore = votersCount * 2;
                            const ratio = maxScore > 0 ? score / maxScore : 0;

                            // Heatmap selection highlight
                            let isHighlighted = false;
                            if (selectedRecommendedSlot && selectedRecommendedSlot.col === col) {
                              const currentIdx = timeSlots.indexOf(slot);
                              if (selectedRecommendedSlot.activeSubSlot) {
                                // If a specific sub-slot is focused inside the group, highlight only that sub-slot!
                                const startIdx = timeSlots.indexOf(selectedRecommendedSlot.activeSubSlot.startSlot);
                                const duration = selectedRecommendedSlot.duration;
                                if (currentIdx >= startIdx && currentIdx < startIdx + duration) {
                                  isHighlighted = true;
                                }
                              } else {
                                if (selectedRecommendedSlot.isGrouped) {
                                  // Direct index boundaries check for groups to prevent end time index lookup failures
                                  if (currentIdx >= selectedRecommendedSlot.slotIndex && currentIdx <= selectedRecommendedSlot.endSlotIndex) {
                                    isHighlighted = true;
                                  }
                                } else {
                                  const startIdx = selectedRecommendedSlot.slotIndex !== undefined
                                    ? selectedRecommendedSlot.slotIndex
                                    : timeSlots.indexOf(selectedRecommendedSlot.startSlot);
                                  const duration = selectedRecommendedSlot.duration;
                                  if (currentIdx >= startIdx && currentIdx < startIdx + duration) {
                                    isHighlighted = true;
                                  }
                                }
                              }
                            }

                            const isHourlyBoundary = slotIdx % 2 === 1;
                            const borderStyle = isHourlyBoundary ? '1px solid #e5e7eb' : '1px dotted #e5e7eb';
                            const isLastSlot = slotIdx === timeSlots.length - 1;

                            const cellStyle = {
                              width: '100%',
                              height: '18px',
                              border: 'none',
                              borderBottom: isLastSlot ? 'none' : borderStyle,
                              margin: 0,
                              padding: 0,
                              boxSizing: 'border-box',
                              cursor: 'default',
                              transition: 'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease',
                              ...(isAnyRequiredUnavailable
                                ? { backgroundColor: 'rgba(239, 68, 68, 0.08)' }
                                : ratio > 0
                                  ? { backgroundColor: `rgba(16, 185, 129, ${0.08 + ratio * 0.82})` }
                                  : { backgroundColor: '#ffffff' }),
                              opacity: selectedRecommendedSlot
                                ? (isHighlighted ? 1 : 0.22)
                                : 1
                            };

                            return (
                              <div
                                key={`${col}-${slot}`}
                                className="heatmap-slot-btn"
                                style={cellStyle}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  // Classify each voter by attendance type + vote state
                                  const reqVoters = []; // { name, state }
                                  const optVoters = []; // { name, state }
                                  voters.forEach(voterKey => {
                                    const voterSlots = meeting.availabilities[voterKey] || {};
                                    const state = voterSlots[getSlotKey(col, slot)] || 'red';
                                    const participant = meeting.participants
                                      ? meeting.participants.find(p => p.id === voterKey || p.name === voterKey)
                                      : null;
                                    const displayName = participant ? participant.name : voterKey;
                                    const attendance = participant ? (participant.attendance || 'required') : 'required';
                                    if (attendance === 'required') {
                                      reqVoters.push({ name: displayName, state });
                                    } else {
                                      optVoters.push({ name: displayName, state });
                                    }
                                  });
                                  setHeatmapTooltip({
                                    col,
                                    slot,
                                    x: (rect.left + rect.width / 2) / 0.9,
                                    y: rect.top / 0.9,
                                    height: rect.height / 0.9,
                                    position: slotIdx < 4 ? 'below' : 'above',
                                    reqVoters,
                                    optVoters
                                  });
                                }}
                                onMouseLeave={() => setHeatmapTooltip(null)}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slots Ranking Section (Always Visible Below Timetable) */}
            {(() => {
              const getRankedSlots = () => {
                // If there are no voters/submissions, return empty array immediately
                if (!voters || voters.length === 0) {
                  return [];
                }
                const ranked = [];
                const D = meetingDuration;

                // Create attendance and name lookup map
                const participantMap = {};
                if (meeting && meeting.participants) {
                  meeting.participants.forEach(p => {
                    const details = { name: p.name, attendance: p.attendance || 'required' };
                    if (p.id) participantMap[p.id] = details;
                    participantMap[p.name] = details; // fallback lookup
                  });
                }

                columns.forEach(col => {
                  for (let i = 0; i <= timeSlots.length - D; i++) {
                    const startSlot = timeSlots[i];

                    let reqPrefCount = 0;
                    let reqPossCount = 0;
                    let reqUnavailCount = 0;
                    let optPrefCount = 0;
                    let optPossCount = 0;
                    let optUnavailCount = 0;

                    const reqPrefNames = [];
                    const reqPossNames = [];
                    const reqUnavailNames = [];
                    const optPrefNames = [];
                    const optPossNames = [];
                    const optUnavailNames = [];

                    voters.forEach(voterKey => {
                      const voterSlots = meeting.availabilities[voterKey] || {};
                      const voterDetails = participantMap[voterKey] || { name: voterKey, attendance: 'required' };
                      const attendanceType = voterDetails.attendance;
                      const name = voterDetails.name;

                      let minScore = 2; // Green (2) is best, Yellow (1), Red (0) is worst
                      for (let j = 0; j < D; j++) {
                        const keyStr = getSlotKey(col, timeSlots[i + j]);
                        const state = voterSlots[keyStr] || 'red';

                        let score = 0;
                        if (state === 'green') score = 2;
                        if (state === 'yellow') score = 1;

                        if (score < minScore) {
                          minScore = score;
                        }
                      }

                      if (attendanceType === 'required') {
                        if (minScore === 2) {
                          reqPrefCount++;
                          reqPrefNames.push(name);
                        } else if (minScore === 1) {
                          reqPossCount++;
                          reqPossNames.push(name);
                        } else {
                          reqUnavailCount++;
                          reqUnavailNames.push(name);
                        }
                      } else {
                        if (minScore === 2) {
                          optPrefCount++;
                          optPrefNames.push(name);
                        } else if (minScore === 1) {
                          optPossCount++;
                          optPossNames.push(name);
                        } else {
                          optUnavailCount++;
                          optUnavailNames.push(name);
                        }
                      }
                    });

                    // Key 0 (Gate): If any required participant is 'Unavail' (Red), exclude this slot
                    if (reqUnavailCount > 0) {
                      continue;
                    }

                    // Key 1: 필수참여자의 '비선호' (Yellow) 수 (오름차순)
                    const key1 = reqPossCount;
                    // Key 2: 필수참여자의 '선호' (Green) 수 (내림차순, 정렬할 때 음수로 처리)
                    const key2 = -reqPrefCount;
                    // Key 3: 선택참여자의 '불가' (Red) 수 (오름차순)
                    const key3 = optUnavailCount;
                    // Key 4: 선택참여자의 '비선호' (Yellow) 수 (오름차순)
                    const key4 = optPossCount;
                    // Key 5: 선택참여자의 '선호' (Green) 수 (내림차순, 정렬할 때 음수로 처리)
                    const key5 = -optPrefCount;

                    // Total utility for trade-off detection (선택참여자 우선순위: 참석 가능자 수 최대화, 선호도 기준 타이 브레이크)
                    const optUtility = (optPrefCount + optPossCount) * 10 + optPrefCount;

                    ranked.push({
                      col,
                      startSlot,
                      slotIndex: i,
                      reqPrefCount,
                      reqPossCount,
                      reqUnavailCount,
                      optPrefCount,
                      optPossCount,
                      optUnavailCount,
                      reqPrefNames,
                      reqPossNames,
                      reqUnavailNames,
                      optPrefNames,
                      optPossNames,
                      optUnavailNames,
                      key1,
                      key2,
                      key3,
                      key4,
                      key5,
                      optUtility
                    });
                  }
                });

                const sortedRaw = ranked.sort((a, b) => {
                  if (a.key1 !== b.key1) return a.key1 - b.key1;
                  if (a.key2 !== b.key2) return a.key2 - b.key2;
                  if (a.key3 !== b.key3) return a.key3 - b.key3;
                  if (a.key4 !== b.key4) return a.key4 - b.key4;
                  return a.key5 - b.key5;
                });

                const getSig = (item) => {
                  const reqP = item.reqPrefNames.slice().sort().join(',');
                  const reqPo = item.reqPossNames.slice().sort().join(',');
                  const reqU = item.reqUnavailNames.slice().sort().join(',');
                  const optP = item.optPrefNames.slice().sort().join(',');
                  const optPo = item.optPossNames.slice().sort().join(',');
                  const optU = item.optUnavailNames.slice().sort().join(',');
                  return `${item.col}|${item.key1}|${item.key2}|${item.key3}|${item.key4}|${item.key5}|${reqP}|${reqPo}|${reqU}|${optP}|${optPo}|${optU}`;
                };

                const sigGroups = {};
                sortedRaw.forEach(item => {
                  const sig = getSig(item);
                  if (!sigGroups[sig]) {
                    sigGroups[sig] = [];
                  }
                  sigGroups[sig].push(item);
                });

                const processedItems = [];
                for (const sig in sigGroups) {
                  const items = sigGroups[sig];
                  items.sort((a, b) => a.slotIndex - b.slotIndex);

                  let currentSegment = [];
                  for (let idx = 0; idx < items.length; idx++) {
                    const current = items[idx];
                    if (currentSegment.length === 0) {
                      currentSegment.push(current);
                    } else {
                      const last = currentSegment[currentSegment.length - 1];
                      if (current.slotIndex === last.slotIndex + 1) {
                        currentSegment.push(current);
                      } else {
                        processSegment(currentSegment, processedItems);
                        currentSegment = [current];
                      }
                    }
                  }
                  if (currentSegment.length > 0) {
                    processSegment(currentSegment, processedItems);
                  }
                }

                function processSegment(segment, dest) {
                  if (segment.length >= 3) {
                    const first = segment[0];
                    const last = segment[segment.length - 1];
                    const endSlot = getEndTimeLabel(last.slotIndex, D);
                    dest.push({
                      ...first,
                      isGrouped: true,
                      endSlot: endSlot,
                      endSlotIndex: last.slotIndex + D - 1,
                      originalSlots: segment
                    });
                  } else {
                    dest.push(...segment);
                  }
                }

                return processedItems.sort((a, b) => {
                  if (a.key1 !== b.key1) return a.key1 - b.key1;
                  if (a.key2 !== b.key2) return a.key2 - b.key2;
                  if (a.key3 !== b.key3) return a.key3 - b.key3;
                  if (a.key4 !== b.key4) return a.key4 - b.key4;
                  return a.key5 - b.key5;
                });
              };

              const rawRankedSlots = getRankedSlots();

              let essentialBest = null;
              let utilityBest = null;

              if (rawRankedSlots.length > 0) {
                // Find essentialBest: Since rawRankedSlots is already sorted by the essential hierarchy, index 0 is best
                essentialBest = rawRankedSlots[0];

                // Find utilityBest: sort by optUtility descending
                const sortedByUtility = [...rawRankedSlots].sort((a, b) => b.optUtility - a.optUtility);
                utilityBest = sortedByUtility[0];
              }

              const hasTradeOff = essentialBest && utilityBest &&
                (essentialBest.col !== utilityBest.col || essentialBest.startSlot !== utilityBest.startSlot);

              // Calculate display rank using Dense Ranking
              let currentRank = 1;
              const rankedSlots = rawRankedSlots.map((item, idx) => {
                const isTied = idx > 0 &&
                  item.key1 === rawRankedSlots[idx - 1].key1 &&
                  item.key2 === rawRankedSlots[idx - 1].key2 &&
                  item.key3 === rawRankedSlots[idx - 1].key3 &&
                  item.key4 === rawRankedSlots[idx - 1].key4 &&
                  item.key5 === rawRankedSlots[idx - 1].key5;
                if (!isTied && idx > 0) {
                  currentRank++;
                }
                return {
                  ...item,
                  displayRank: currentRank
                };
              });

              return (
                <div className="ranking-section">



                  {/* Toss-style Custom Range Slider (30 mins = 1 block to 4 hours = 8 blocks) */}
                  <div className="duration-filter-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '1.05rem',
                      fontWeight: '500',
                      color: '#4e5968',
                      lineHeight: '1.8',
                      letterSpacing: '-0.01em',
                      marginTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}>
                      {isDurationEditing ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="text"
                            value={durationInputVal}
                            onChange={(e) => setDurationInputVal(e.target.value)}
                            onBlur={() => {
                              setIsDurationEditing(false);
                              // Parse the input value
                              const raw = durationInputVal.trim();
                              let totalMins = 0;

                              // Check if we matches pattern: "X시간 Y분" or "X시간" or "Y분" or just numbers
                              const hourMatch = raw.match(/(\d+)\s*시간/);
                              const minMatch = raw.match(/(\d+)\s*분/);

                              if (hourMatch || minMatch) {
                                if (hourMatch) totalMins += parseInt(hourMatch[1]) * 60;
                                if (minMatch) totalMins += parseInt(minMatch[1]);
                              } else {
                                // Try pure numeric value as minutes
                                const pureNum = parseInt(raw.replace(/\D/g, ''));
                                if (!isNaN(pureNum)) {
                                  // If they entered e.g. "1.5" or just numbers, evaluate
                                  totalMins = pureNum;
                                }
                              }

                              // Validation: Max span based on 09:00 ~ 18:00 (or custom startTime ~ endTime from meeting)
                              const startStr = meeting?.startTime || "09:00";
                              const endStr = meeting?.endTime || "18:00";
                              const [sH, sM] = startStr.split(':').map(Number);
                              const [eH, eM] = endStr.split(':').map(Number);
                              const maxAllowedMins = (eH * 60 + eM) - (sH * 60 + sM);

                              if (totalMins < 30) {
                                // Under 30 minutes warning
                                setWarningMessage("범비보다 긴 회의 시간은 설정할 수 없어요.");
                                setShowWarningToast(true);
                                setTimeout(() => setShowWarningToast(false), 3000);
                              } else if (totalMins > maxAllowedMins) {
                                // Over maximum range limits
                                setWarningMessage("범위보다 긴 회의 시간은 설정할 수 없어요.");
                                setShowWarningToast(true);
                                setTimeout(() => setShowWarningToast(false), 3000);
                              } else {
                                // Convert back to 30-min block count (rounded)
                                const blocks = Math.max(1, Math.round(totalMins / 30));
                                handleDurationChange(blocks);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            autoFocus
                            style={{
                              padding: '4px 12px', // Increased padding
                              backgroundColor: '#ffffff',
                              border: '1.5px solid #3182F6',
                              borderRadius: '8px',
                              color: '#3182F6',
                              fontWeight: '700',
                              fontSize: '0.95rem',
                              width: '110px', // Expanded width to fit Y시간 XX분 text comfortably
                              outline: 'none',
                              textAlign: 'center',
                              boxShadow: '0 0 0 3px rgba(49, 130, 246, 0.15)'
                            }}
                          />
                          <span>간의 회의를 위한 시간대에요</span>
                        </div>
                      ) : (
                        <>
                          <span
                            onClick={() => {
                              const mins = meetingDuration * 30;
                              const hrs = Math.floor(mins / 60);
                              const remainingMins = mins % 60;
                              setDurationInputVal(hrs > 0 ? `${hrs}시간 ${remainingMins > 0 ? `${remainingMins}분` : '00분'}` : `0시간 ${mins}분`);
                              setIsDurationEditing(true);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px 10px',
                              backgroundColor: '#ffffff',
                              border: '1.5px solid #3182F6',
                              borderRadius: '8px',
                              color: '#3182F6',
                              fontWeight: '700',
                              fontSize: '0.95rem',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(49, 130, 246, 0.08)',
                              transition: 'transform 0.1s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            {(() => {
                              const mins = meetingDuration * 30;
                              const hrs = Math.floor(mins / 60);
                              const remainingMins = mins % 60;
                              if (hrs > 0) {
                                return remainingMins > 0 ? `${hrs}시간 ${remainingMins}분` : `${hrs}시간`;
                              }
                              return `${mins}분`;
                            })()}
                          </span>
                          <span>동안의 회의를 위한 시간대에요</span>
                        </>
                      )}
                    </div>

                    {/* Toss-style Custom Range Slider - Smoothly slides up/down when meetingDuration changes */}
                    <div style={{
                      maxHeight: meetingDuration > 8 ? '0px' : '60px',
                      opacity: meetingDuration > 8 ? 0 : 1,
                      overflow: 'hidden',
                      transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      width: '100%'
                    }}>

                      <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        height: '36px',
                        width: '100%',
                        padding: '0 8px', // Back to container edge padding
                        boxSizing: 'border-box'
                      }}>
                        {/* Range slider track background - goes fully edge-to-edge */}
                        <div style={{
                          position: 'absolute',
                          left: '8px',
                          right: '8px',
                          height: '6px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '3px',
                          zIndex: 1
                        }} />

                        {/* Active track bar fill - matches native handle coordinates */}
                        <div style={{
                          position: 'absolute',
                          left: '8px',
                          width: `calc((100% - 16px) * ${(meetingDuration - 1) / 7})`,
                          height: '6px',
                          backgroundColor: '#3182F6',
                          borderRadius: '3px',
                          zIndex: 2
                        }} />

                        {/* Dynamic Dark Badge - remains safely offset inside by using 36px boundary offsets to never cross the line borders */}
                        <div style={{
                          position: 'absolute',
                          left: `calc(36px + (100% - 72px) * ${(meetingDuration - 1) / 7})`,
                          backgroundColor: '#191f28',
                          color: '#ffffff',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          pointerEvents: 'none',
                          zIndex: 10,
                          boxShadow: '0 3px 8px rgba(0, 0, 0, 0.22)',
                          whiteSpace: 'nowrap',
                          transform: 'translateX(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1.5px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          {(() => {
                            const mins = meetingDuration * 30;
                            const hrs = Math.floor(mins / 60);
                            const remainingMins = mins % 60;
                            if (hrs > 0) {
                              return remainingMins > 0 ? `${hrs}시간 ${remainingMins}분` : `${hrs}시간`;
                            }
                            return `${mins}분`;
                          })()}
                        </div>

                        {/* Hidden native input overlays matching the slider bounds */}
                        <input
                          type="range"
                          min="1"
                          max="8"
                          step="1"
                          value={meetingDuration}
                          onChange={(e) => handleDurationChange(Number(e.target.value))}
                          style={{
                            position: 'absolute',
                            width: 'calc(100% - 16px)', // Reverted to full width bounds
                            height: '28px',
                            left: '8px', // Reverted to edge margin
                            background: 'none',
                            pointerEvents: 'none',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            outline: 'none',
                            margin: 0,
                            zIndex: 12
                          }}
                          className="duration-range-slider-input"
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '-2px', padding: '0 8px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 500 }}>30분</span>
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 500 }}>4시간</span>
                      </div>
                    </div>
                  </div>

                  {votersCount >= 2 && hasTradeOff && showTradeOff && (
                    <div
                      className="trade-off-alert"
                      style={{
                        position: 'relative',
                        backgroundColor: '#ffffff',
                        border: '1px solid #f2f4f7',
                        borderRadius: '16px',
                        padding: isTradeOffClosing ? '0px 20px' : '18px 20px', // smoothly collapse vertical padding
                        marginBottom: isTradeOffClosing ? '0px' : '24px',
                        fontSize: '0.88rem',
                        lineHeight: '1.6',
                        color: '#333d4b',
                        boxShadow: isTradeOffClosing ? 'none' : '0 8px 24px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.02)',
                        overflow: 'hidden',
                        maxHeight: isTradeOffClosing ? '0px' : '600px', // matches local content height
                        opacity: isTradeOffClosing ? 0 : 1,
                        transform: isTradeOffClosing ? 'translateY(-12px)' : 'translateY(0)',
                        transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin-bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease-out'
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsTradeOffClosing(true);
                          setTimeout(() => {
                            setShowTradeOff(false);
                            setIsTradeOffClosing(false);
                          }, 250); // matches transition duration (0.25s)
                        }}
                        style={{
                          position: 'absolute',
                          top: '14px',
                          right: '14px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#8b95a1',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          transition: 'background-color 0.2s',
                          zIndex: 15
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="닫기"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>

                      <div style={{
                        fontWeight: '700',
                        color: '#3182F6',
                        fontSize: '0.92rem',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        letterSpacing: '-0.01em'
                      }}>
                        어떤 기준을 더 선호하시나요?
                      </div>

                      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', width: '100%', boxSizing: 'border-box' }}>
                        {/* A-Plan Card (Essential Best) */}
                        {(() => {
                          const isEssentialSelected = selectedRecommendedSlot &&
                            selectedRecommendedSlot.col === essentialBest.col &&
                            selectedRecommendedSlot.startSlot === essentialBest.startSlot &&
                            selectedRecommendedSlot.duration === meetingDuration;
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isEssentialSelected) {
                                  setSelectedRecommendedSlot(null);
                                } else {
                                  setSelectedRecommendedSlot({
                                    col: essentialBest.col,
                                    startSlot: essentialBest.startSlot,
                                    endSlot: essentialBest.endSlot,
                                    endSlotIndex: essentialBest.endSlotIndex,
                                    slotIndex: essentialBest.slotIndex,
                                    isGrouped: essentialBest.isGrouped,
                                    duration: meetingDuration
                                  });
                                }
                                setTradeOffFlash(false);
                                setTimeout(() => setTradeOffFlash(true), 10);
                              }}
                              style={{
                                flex: 1,
                                backgroundColor: isEssentialSelected ? '#f2f8ff' : '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '14px',
                                padding: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                transition: 'all 0.15s',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isEssentialSelected ? '#e8f3ff' : '#f2f4f7';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isEssentialSelected ? '#f2f8ff' : '#ffffff';
                              }}
                            >
                              <div>
                                <div style={{ color: '#191f28', fontSize: '0.88rem', fontWeight: '700', textDecoration: 'underline', textUnderlineOffset: '3px', decorationColor: 'rgba(49, 130, 246, 0.3)', marginBottom: '4px' }}>
                                  {formatColumnLabel(essentialBest.col)} {essentialBest.startSlot} ~ {getEndTimeLabel(essentialBest.slotIndex, meetingDuration)}
                                  {(() => {
                                    const tiesCount = rankedSlots.filter(s => s.displayRank === 1).length;
                                    return tiesCount > 1 ? ` 외 ${tiesCount - 1}개` : '';
                                  })()}
                                </div>
                                <span style={{ color: '#4e5968', display: 'block', fontSize: '0.76rem', lineHeight: '1.4', fontWeight: '500' }}>
                                  모든 필수참여자가 가장 편한 시간이에요.
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px dashed #f3f4f6', paddingTop: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#8b95a1' }}>필수 참석자</span>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', width: '100%' }}>
                                    {essentialBest.reqPrefNames.map(name => (
                                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                        </div>
                                      </div>
                                    ))}
                                    {essentialBest.reqPossNames.map(name => (
                                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5 L20 19 H4 Z" /></svg>
                                        </div>
                                      </div>
                                    ))}
                                    {essentialBest.reqUnavailNames.map(name => (
                                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                        </div>
                                      </div>
                                    ))}
                                    {essentialBest.reqPrefNames.length === 0 && essentialBest.reqPossNames.length === 0 && essentialBest.reqUnavailNames.length === 0 && (
                                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic' }}>없음</span>
                                    )}
                                  </div>
                                </div>
                                {hasAnyOptional && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#8b95a1' }}>선택 참석자</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', width: '100%' }}>
                                      {essentialBest.optPrefNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                          </div>
                                        </div>
                                      ))}
                                      {essentialBest.optPossNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5 L20 19 H4 Z" /></svg>
                                          </div>
                                        </div>
                                      ))}
                                      {essentialBest.optUnavailNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                          </div>
                                        </div>
                                      ))}
                                      {essentialBest.optPrefNames.length === 0 && essentialBest.optPossNames.length === 0 && essentialBest.optUnavailNames.length === 0 && (
                                        <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic' }}>없음</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* B-Plan Card (Utility Best) */}
                        {(() => {
                          const isUtilitySelected = selectedRecommendedSlot &&
                            selectedRecommendedSlot.col === utilityBest.col &&
                            selectedRecommendedSlot.startSlot === utilityBest.startSlot &&
                            selectedRecommendedSlot.duration === meetingDuration;
                          return (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isUtilitySelected) {
                                  setSelectedRecommendedSlot(null);
                                } else {
                                  setSelectedRecommendedSlot({
                                    col: utilityBest.col,
                                    startSlot: utilityBest.startSlot,
                                    endSlot: utilityBest.endSlot,
                                    endSlotIndex: utilityBest.endSlotIndex,
                                    slotIndex: utilityBest.slotIndex,
                                    isGrouped: utilityBest.isGrouped,
                                    duration: meetingDuration
                                  });
                                }
                                setTradeOffFlash(false);
                                setTimeout(() => setTradeOffFlash(true), 10);
                              }}
                              style={{
                                flex: 1,
                                backgroundColor: isUtilitySelected ? '#f2f8ff' : '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '14px',
                                padding: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                transition: 'all 0.15s',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isUtilitySelected ? '#e8f3ff' : '#f2f4f7';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isUtilitySelected ? '#f2f8ff' : '#ffffff';
                              }}
                            >
                              <div>
                                <div style={{ color: '#191f28', fontSize: '0.88rem', fontWeight: '700', textDecoration: 'underline', textUnderlineOffset: '3px', decorationColor: 'rgba(78, 89, 104, 0.3)', marginBottom: '4px' }}>
                                  {formatColumnLabel(utilityBest.col)} {utilityBest.startSlot} ~ {getEndTimeLabel(utilityBest.slotIndex, meetingDuration)}
                                </div>
                                <span style={{ color: '#4e5968', display: 'block', fontSize: '0.76rem', lineHeight: '1.4', fontWeight: '500' }}>
                                  가장 많은 참여자가 참여할 수 있는 시간이에요.
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px dashed #f3f4f6', paddingTop: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#8b95a1' }}>필수 참석자</span>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', width: '100%' }}>
                                    {utilityBest.reqPrefNames.map(name => (
                                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                        </div>
                                      </div>
                                    ))}
                                    {utilityBest.reqPossNames.map(name => (
                                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5 L20 19 H4 Z" /></svg>
                                        </div>
                                      </div>
                                    ))}
                                    {utilityBest.reqUnavailNames.map(name => (
                                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                        </div>
                                      </div>
                                    ))}
                                    {utilityBest.reqPrefNames.length === 0 && utilityBest.reqPossNames.length === 0 && utilityBest.reqUnavailNames.length === 0 && (
                                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic' }}>없음</span>
                                    )}
                                  </div>
                                </div>
                                {hasAnyOptional && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#8b95a1' }}>선택 참석자</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', width: '100%' }}>
                                      {utilityBest.optPrefNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                          </div>
                                        </div>
                                      ))}
                                      {utilityBest.optPossNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5 L20 19 H4 Z" /></svg>
                                          </div>
                                        </div>
                                      ))}
                                      {utilityBest.optUnavailNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#4e5968' }}>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}님</span>
                                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                          </div>
                                        </div>
                                      ))}
                                      {utilityBest.optPrefNames.length === 0 && utilityBest.optPossNames.length === 0 && utilityBest.optUnavailNames.length === 0 && (
                                        <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic' }}>없음</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="rankings-list">
                    {votersCount <= 1 ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px 24px',
                        textAlign: 'center',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          backgroundColor: '#f2f8ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '16px'
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3182F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" x2="12" y1="8" y2="12" />
                            <line x1="12" x2="12.01" y1="16" y2="16" />
                          </svg>
                        </div>
                        <h3 style={{
                          fontSize: '1.15rem',
                          fontWeight: '600',
                          color: '#191f28',
                          margin: '0 0 8px 0',
                          letterSpacing: '-0.01em'
                        }}>
                          아직 참여자가 충분하지 않아요
                        </h3>
                        <p style={{
                          fontSize: '0.88rem',
                          color: '#8b95a1',
                          margin: 0,
                          lineHeight: '1.5',
                          fontWeight: '500'
                        }}>
                          2명 이상의 참여자가 일정을 제출하면<br />
                          최적의 추천 회의 시간을 분석해 드릴게요.
                        </p>
                      </div>
                    ) : rankedSlots.length > 0 ? (
                      rankedSlots.slice(0, 10).map((item, idx) => {
                        let badgeClass = '';
                        if (item.displayRank === 1) badgeClass = 'first';
                        else if (item.displayRank === 2) badgeClass = 'second';
                        else if (item.displayRank === 3) badgeClass = 'third';

                        const endLabel = getEndTimeLabel(item.slotIndex, meetingDuration);

                        const isCardSelected = selectedRecommendedSlot &&
                          selectedRecommendedSlot.col === item.col &&
                          selectedRecommendedSlot.startSlot === item.startSlot &&
                          selectedRecommendedSlot.duration === meetingDuration;

                        // Check if this card corresponds to A-plan (essentialBest) or B-plan (utilityBest)
                        const isEssentialPlan = essentialBest && item.col === essentialBest.col && item.startSlot === essentialBest.startSlot;
                        const isUtilityPlan = utilityBest && item.col === utilityBest.col && item.startSlot === utilityBest.startSlot;
                        const shouldFlash = tradeOffFlash && (isEssentialPlan || isUtilityPlan);

                        // Generate element ID if it corresponds to essential/utility best
                        let cardId = undefined;
                        if (isEssentialPlan) cardId = 'rank-card-essential';
                        else if (isUtilityPlan) cardId = 'rank-card-utility';

                        return (
                          <div
                            key={idx}
                            id={cardId}
                            className={`rank-card ${isCardSelected ? 'selected-highlight' : ''} ${shouldFlash ? 'trade-off-flash-active' : ''}`}
                            onClick={() => {
                              if (isCardSelected) {
                                setSelectedRecommendedSlot(null);
                              } else {
                                setSelectedRecommendedSlot({
                                  col: item.col,
                                  startSlot: item.startSlot,
                                  endSlot: item.endSlot,
                                  endSlotIndex: item.endSlotIndex,
                                  slotIndex: item.slotIndex,
                                  isGrouped: item.isGrouped,
                                  duration: meetingDuration
                                });
                              }
                            }}
                            style={{
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              gap: '10px',
                              cursor: 'pointer',
                              border: '1px solid #e5e7eb',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <div className="rank-badge-wrapper">
                                <span className={`rank-badge ${badgeClass}`}>
                                  {(() => {
                                    // Check if this rank has multiple tied entries
                                    const isTied = rankedSlots.filter(s => s.displayRank === item.displayRank).length > 1;
                                    return isTied ? `공동 ${item.displayRank}순위` : `${item.displayRank}순위`;
                                  })()}
                                </span>
                                <span className="rank-time-text">
                                  {item.isGrouped
                                    ? `${formatColumnLabel(item.col)} ${item.startSlot} ~ ${item.endSlot}사이 `
                                    : `${formatColumnLabel(item.col)} ${item.startSlot} ~ ${endLabel}`
                                  }
                                </span>
                              </div>
                            </div>

                            {/* Grouped Voters breakdown list (Split Left/Right) */}
                            <div className="rank-voter-details">
                              {/* Left Panel: Required Voters */}
                              <div className="voter-attendance-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <span className="attendance-group-title">필수 참석자</span>

                                <div style={{ display: 'grid', gridTemplateColumns: hasAnyOptional ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '6px 12px', width: '100%' }}>
                                  {item.reqPrefNames.map(name => (
                                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#374151', padding: '2px 0' }}>
                                      <span>{name}님</span>
                                      <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                      </div>
                                    </div>
                                  ))}

                                  {item.reqPossNames.map(name => (
                                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#374151', padding: '2px 0' }}>
                                      <span>{name}님</span>
                                      <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5 L20 19 H4 Z" /></svg>
                                      </div>
                                    </div>
                                  ))}

                                  {item.reqUnavailNames.map(name => (
                                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#374151', padding: '2px 0' }}>
                                      <span>{name}님</span>
                                      <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {item.reqPrefNames.length === 0 && item.reqPossNames.length === 0 && item.reqUnavailNames.length === 0 && (
                                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontStyle: 'italic' }}>응답 없음</span>
                                )}
                              </div>

                              {hasAnyOptional && (
                                <>
                                  {/* Vertical Divider */}
                                  <div style={{ width: '1px', backgroundColor: '#f2f4f7', alignSelf: 'stretch', margin: '0 4px' }} />

                                  {/* Right Panel: Optional Voters */}
                                  <div className="voter-attendance-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span className="attendance-group-title">선택 참석자</span>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', width: '100%' }}>
                                      {item.optPrefNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#374151', padding: '2px 0' }}>
                                          <span>{name}님</span>
                                          <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                          }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                          </div>
                                        </div>
                                      ))}

                                      {item.optPossNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#374151', padding: '2px 0' }}>
                                          <span>{name}님</span>
                                          <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                          }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5 L20 19 H4 Z" /></svg>
                                          </div>
                                        </div>
                                      ))}

                                      {item.optUnavailNames.map(name => (
                                        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#374151', padding: '2px 0' }}>
                                          <span>{name}님</span>
                                          <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                          }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {item.optPrefNames.length === 0 && item.optPossNames.length === 0 && item.optUnavailNames.length === 0 && (
                                      <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontStyle: 'italic' }}>응답 없음</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* If card is grouped, show expanded slot list with CSS height transitions */}
                            {item.isGrouped && (
                              <div className={`list-expand-wrapper-grouped ${isCardSelected ? 'expanded' : ''}`}>
                                <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#4e5968', marginBottom: '4px', marginTop: '12px' }}>
                                  선택 가능한 시간대 목록
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {item.originalSlots.map((slotItem) => {
                                    const endLabel = getEndTimeLabel(slotItem.slotIndex, meetingDuration);
                                    const timeLabel = `${slotItem.startSlot} ~ ${endLabel}`;
                                    const isSubSlotFocused = selectedRecommendedSlot &&
                                      selectedRecommendedSlot.activeSubSlot &&
                                      selectedRecommendedSlot.activeSubSlot.startSlot === slotItem.startSlot;
                                    return (
                                      <div
                                        key={slotItem.startSlot}
                                        className="time-row-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedRecommendedSlot(prev => {
                                            if (!prev) return prev;
                                            if (prev.activeSubSlot && prev.activeSubSlot.startSlot === slotItem.startSlot) {
                                              return { ...prev, activeSubSlot: null };
                                            } else {
                                              return {
                                                ...prev,
                                                activeSubSlot: { startSlot: slotItem.startSlot }
                                              };
                                            }
                                          });
                                        }}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '6px 10px',
                                          backgroundColor: isSubSlotFocused ? '#E8F3FF' : '#f8fafc',
                                          borderRadius: '10px',
                                          border: isSubSlotFocused ? '1px solid #3182F6' : '1px solid #f1f5f9',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#191f28' }}>
                                          {timeLabel}
                                        </span>
                                        <button
                                          type="button"
                                          className="row-confirm-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleConfirmTime({
                                              ...item,
                                              isGrouped: false,
                                              startSlot: slotItem.startSlot,
                                              slotIndex: slotItem.slotIndex
                                            });
                                          }}
                                          style={{
                                            backgroundColor: '#3182F6',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '6px 12px',
                                            fontSize: '0.72rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1b64da'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3182F6'}
                                        >
                                          이 시간으로 확정하기
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* If card is a single time slot, show confirm button with CSS height transitions */}
                            {!item.isGrouped && (
                              <div className={`confirm-btn-wrapper-ungrouped ${isCardSelected ? 'expanded' : ''}`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmTime(item);
                                  }}
                                  style={{
                                    backgroundColor: '#3182F6',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '8px 16px',
                                    fontSize: '0.78rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1b64da'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3182F6'}
                                >
                                  이 시간으로 확정하기
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px 24px',
                        textAlign: 'center',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          backgroundColor: '#fff4e6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '16px'
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff922b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" x2="12" y1="8" y2="12" />
                            <line x1="12" x2="12.01" y1="16" y2="16" />
                          </svg>
                        </div>
                        <h3 style={{
                          fontSize: '1.15rem',
                          fontWeight: '600',
                          color: '#191f28',
                          margin: '0 0 8px 0',
                          letterSpacing: '-0.01em'
                        }}>
                          조건에 맞는 추천 일정이 없어요
                        </h3>
                        <p style={{
                          fontSize: '0.88rem',
                          color: '#8b95a1',
                          margin: 0,
                          lineHeight: '1.5',
                          fontWeight: '500'
                        }}>
                          회의 길이를 더 짧게 조절하거나,<br />
                          참여 가능한 요일과 시간대를 넓혀보세요.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}



          </div>
        </div>
      </div>

      {/* Copy Toast */}
      <div className={`toast-popup ${copied ? 'show' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3182F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span>회의 링크가 클립보드에 복사되었습니다!</span>
      </div>

      {/* Database Save Feedback Toast */}
      <div className={`toast-popup ${showFeedbackToast ? 'show' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span>{toastMessage}</span>
      </div>

      {/* Yellow Warning Toast with a Warning Icon (Exclamation mark inside triangle) */}
      <div className={`toast-popup ${showWarningToast ? 'show' : ''}`} style={{
        borderLeft: '4px solid #f59e0b',
        boxShadow: '0 4px 18px rgba(245, 158, 11, 0.15)'
      }}>
        {/* Yellow Exclamation Warning Mark */}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
        <span style={{ color: '#191f28', fontWeight: 600 }}>{warningMessage}</span>
      </div>
    </>
  );
}

export default MeetingDetails;
