// Schedule Manager Application
class ScheduleManager {
    constructor() {
        this.schedules = this.loadSchedules();
        this.teachers = this.loadTeachers();
        this.rooms = this.loadRooms();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.render();
        this.renderTeacherOptions();
        this.renderRoomOptions();
    }

    setupEventListeners() {
        document.getElementById('scheduleForm').addEventListener('submit', (e) => this.handleAddSchedule(e));
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            // view toggles already wired in HTML; keep existing behavior
            btn.addEventListener('click', (e) => {
                if (e.target.dataset && e.target.dataset.view) this.switchView(e);
            });
        });

        document.getElementById('addTeacherBtn').addEventListener('click', () => this.handleAddTeacher());
        document.getElementById('addRoomBtn').addEventListener('click', () => this.handleAddRoom());
        document.getElementById('closeScheduleModal').addEventListener('click', () => this.hideTeacherSchedule());
        document.getElementById('teacherScheduleModal').addEventListener('click', (e) => {
            if (e.target.id === 'teacherScheduleModal') this.hideTeacherSchedule();
        });

        // PDF / Print buttons in modal
        const viewPdfBtn = document.getElementById('viewPdfBtn');
        const printBtn = document.getElementById('printBtn');
        if (viewPdfBtn) viewPdfBtn.addEventListener('click', () => this.viewSchedulePdf());
        if (printBtn) printBtn.addEventListener('click', () => this.printSchedule());

        // update available rooms when day/time changes
        ['day', 'startTime', 'endTime'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updateRoomOptions());
        });
    }

    handleAddTeacher() {
        const input = document.getElementById('newTeacher');
        const name = input.value.trim();
        if (!name) return this.showNotification('Please enter a teacher name to add.', 'error');
        if (this.teachers.includes(name)) return this.showNotification('Teacher already exists.', 'error');
        this.teachers.push(name);
        this.saveTeachers();
        input.value = '';
        this.renderTeacherOptions();
        this.showNotification('Teacher added.', 'success');
    }

    handleAddRoom() {
        const input = document.getElementById('newRoom');
        const name = input.value.trim();
        if (!name) return this.showNotification('Please enter a room name to add.', 'error');
        if (this.rooms.includes(name)) return this.showNotification('Room already exists.', 'error');
        this.rooms.push(name);
        this.saveRooms();
        input.value = '';
        this.renderRoomOptions();
        this.showNotification('Room added.', 'success');
        this.updateRoomOptions();
    }

    handleAddSchedule(e) {
        e.preventDefault();

        const teacherName = document.getElementById('teacherSelect').value;
        const subject = document.getElementById('subject').value.trim();
        const sectionYear = document.getElementById('sectionYear').value.trim();
        const day = document.getElementById('day').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const room = document.getElementById('roomSelect').value;

        const schedule = {
            id: Date.now(),
            teacherName,
            subject,
            sectionYear,
            day,
            startTime,
            endTime,
            room
        };

        // Validation
        const validationError = this.validateSchedule(schedule);
        if (validationError) {
            this.showNotification(validationError, 'error');
            return;
        }

        // Check for conflicts with structured details
        const conflictCheck = this.checkConflicts(schedule);
        if (conflictCheck.hasConflict) {
            // Format clear message
            const bullets = conflictCheck.conflicts.map(c => `<li><strong>${c.type}:</strong> ${c.message}</li>`).join('');
            const html = `⚠️ Conflict detected:<ul style="margin-top:8px">${bullets}</ul>`;
            this.showNotification(html, 'error');
            return;
        }

        // Add schedule
        this.schedules.push(schedule);
        this.saveSchedules();
        this.showNotification('✓ Schedule added successfully!', 'success');
        document.getElementById('scheduleForm').reset();
        this.render();
        this.updateRoomOptions();
    }

    validateSchedule(schedule) {
        if (!schedule.teacherName || !schedule.subject || !schedule.sectionYear || !schedule.day || !schedule.startTime || !schedule.endTime || !schedule.room) {
            return 'Please fill in all fields.';
        }

        if (schedule.startTime >= schedule.endTime) {
            return 'End time must be after start time.';
        }

        const [sh] = schedule.startTime.split(':').map(x => parseInt(x));
        const [eh, em] = schedule.endTime.split(':').map(x => parseInt(x));
        if (sh < 7 || eh > 19 || (eh === 19 && em > 0)) {
            return 'Classes must be between 7:00 AM and 7:00 PM.';
        }

        return null;
    }

    // returns structured conflict info
    checkConflicts(newSchedule) {
        const conflicts = [];
        for (const schedule of this.schedules) {
            if (schedule.day !== newSchedule.day) continue;

            // teacher conflict
            if (schedule.teacherName.toLowerCase() === newSchedule.teacherName.toLowerCase()) {
                if (this.timesOverlap(schedule.startTime, schedule.endTime, newSchedule.startTime, newSchedule.endTime)) {
                    conflicts.push({
                        type: 'Teacher conflict',
                        message: `${schedule.teacherName} is already scheduled for ${schedule.subject} in ${schedule.room} from ${this.formatTime(schedule.startTime)} to ${this.formatTime(schedule.endTime)}.`
                        
                    });
                }
            }

            // room conflict
            if (schedule.room.toLowerCase() === newSchedule.room.toLowerCase()) {
                if (this.timesOverlap(schedule.startTime, schedule.endTime, newSchedule.startTime, newSchedule.endTime)) {
                    conflicts.push({
                        type: 'Room conflict',
                        message: `${schedule.room} is already in use by ${schedule.teacherName} for ${schedule.subject} from ${this.formatTime(schedule.startTime)} to ${this.formatTime(schedule.endTime)}.`
                    });
                }
            }
        }

        // Deduplicate based on message
        const unique = [];
        const seen = new Set();
        for (const c of conflicts) {
            if (!seen.has(c.message)) {
                unique.push(c);
                seen.add(c.message);
            }
        }

        return { hasConflict: unique.length > 0, conflicts: unique };
    }

    timesOverlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    getTeacherSchedules(teacherName) {
        return this.schedules.filter(s => s.teacherName.toLowerCase() === teacherName.toLowerCase());
    }

    getTeacherConflicts(teacherName) {
        const teacherSchedules = this.getTeacherSchedules(teacherName);
        const conflicts = [];
        for (let i = 0; i < teacherSchedules.length; i++) {
            for (let j = i + 1; j < teacherSchedules.length; j++) {
                const a = teacherSchedules[i];
                const b = teacherSchedules[j];
                if (a.day === b.day && this.timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                    conflicts.push({ schedule1: a, schedule2: b });
                }
            }
        }
        return conflicts;
    }

    deleteSchedule(id) {
        if (confirm('Are you sure you want to delete this schedule?')) {
            this.schedules = this.schedules.filter(s => s.id !== id);
            this.saveSchedules();
            this.render();
            this.showNotification('Schedule deleted.', 'success');
            this.updateRoomOptions();
        }
    }

    render() {
        this.renderTeacherView();
        this.renderAllView();
    }

    renderTeacherView() {
        const teacherList = document.getElementById('teacherList');
        const uniqueTeachers = [...new Set(this.schedules.map(s => s.teacherName))];
        if (uniqueTeachers.length === 0) {
            teacherList.innerHTML = '<p class="empty-message">No schedules yet. Add one to get started!</p>';
            return;
        }

        teacherList.innerHTML = uniqueTeachers.map(teacherName => {
            const teacherSchedules = this.getTeacherSchedules(teacherName);
            const conflicts = this.getTeacherConflicts(teacherName);
            const hasConflict = conflicts.length > 0;

            return `
                <div class="teacher-card ${hasConflict ? 'has-conflict' : ''}">
                    <div class="teacher-name">
                        ${teacherName}
                        ${hasConflict ? '<span class="conflict-badge">⚠️ CONFLICT</span>' : ''}
                    </div>
                    ${hasConflict ? `
                        <div class="conflict-notice">
                            ❌ This teacher has ${conflicts.length} scheduling conflict(s). Please fix before confirming.
                        </div>
                    ` : ''}
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Section / Year</th>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Room</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherSchedules.map(schedule => {
                                const isConflicted = conflicts.some(c => c.schedule1.id === schedule.id || c.schedule2.id === schedule.id);
                                return `
                                    <tr class="${isConflicted ? 'conflict-row' : ''}">
                                        <td>${schedule.subject}</td>
                                        <td>${schedule.sectionYear}</td>
                                        <td>${schedule.day}</td>
                                        <td>${this.formatTime(schedule.startTime)} - ${this.formatTime(schedule.endTime)}</td>
                                        <td>${schedule.room}</td>
                                        <td><button class="delete-btn" onclick="manager.deleteSchedule(${schedule.id})">Delete</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="view-row">
                        <button class="btn-view" onclick="manager.showTeacherSchedule('${teacherName.replace(/'/g, "\\'")}')">View Timetable</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAllView() {
        const allSchedules = document.getElementById('allSchedules');
        if (this.schedules.length === 0) {
            allSchedules.innerHTML = '<p class="empty-message">No schedules yet. Add one to get started!</p>';
            return;
        }

        // Group schedules by teacher and sort
        const grouped = {};
        this.schedules.forEach(s => {
            if (!grouped[s.teacherName]) grouped[s.teacherName] = [];
            grouped[s.teacherName].push(s);
        });

        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        Object.keys(grouped).forEach(teacher => {
            grouped[teacher].sort((a, b) => (dayOrder[a.day] - dayOrder[b.day]) || a.startTime.localeCompare(b.startTime));
        });

        const teachersSorted = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

        allSchedules.innerHTML = teachersSorted.map(teacherName => {
            const teacherSchedules = grouped[teacherName];
            const conflicts = this.getTeacherConflicts(teacherName);
            const hasConflict = conflicts.length > 0;

            return `
                <div class="teacher-card ${hasConflict ? 'has-conflict' : ''}">
                    <div class="teacher-name">
                        ${teacherName}
                        ${hasConflict ? '<span class="conflict-badge">⚠️ CONFLICT</span>' : ''}
                    </div>
                    ${hasConflict ? `
                        <div class="conflict-notice">
                            ❌ This teacher has ${conflicts.length} scheduling conflict(s).
                        </div>
                    ` : ''}
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Room</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherSchedules.map(schedule => {
                                const isConflicted = conflicts.some(c => c.schedule1.id === schedule.id || c.schedule2.id === schedule.id);
                                return `
                                    <tr class="${isConflicted ? 'conflict-row' : ''}">
                                        <td>${schedule.subject}</td>
                                        <td>${schedule.day}</td>
                                        <td>${this.formatTime(schedule.startTime)} - ${this.formatTime(schedule.endTime)}</td>
                                        <td>${schedule.room}</td>
                                        <td><button class="delete-btn" onclick="manager.deleteSchedule(${schedule.id})">Delete</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');
    }

    switchView(e) {
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const viewType = e.target.dataset.view;
        document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
        document.getElementById(viewType === 'teacher' ? 'teacherView' : 'allView').classList.add('active');
    }

    showTeacherSchedule(teacherName) {
        const teacherSchedules = this.getTeacherSchedules(teacherName);
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const slots = this.generateTimeSlots();
        const grid = this.buildScheduleGrid(teacherSchedules, dayOrder, slots);

        document.getElementById('modalTeacherName').textContent = `${teacherName} — Plotted Schedule`;
        document.getElementById('scheduleGridContainer').innerHTML = grid;
        document.getElementById('teacherScheduleModal').classList.remove('hidden');
    }

    hideTeacherSchedule() {
        document.getElementById('teacherScheduleModal').classList.add('hidden');
    }

    generateTimeSlots() {
        const slots = [];
        let minutes = 7 * 60;
        while (minutes < 19 * 60) {
            const startH = Math.floor(minutes / 60);
            const startM = minutes % 60;
            const endMinutes = minutes + 30;
            const endH = Math.floor(endMinutes / 60);
            const endM = endMinutes % 60;
            const format = (h, m) => `${((h + 11) % 12) + 1}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
            slots.push({
                start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
                label: `${format(startH, startM)} - ${format(endH, endM)}`
            });
            minutes += 30;
        }
        return slots;
    }

    buildScheduleGrid(schedules, days, slots) {
        const cells = {};
        schedules.forEach(schedule => {
            const scheduleStart = this.timeToMinutes(schedule.startTime);
            const scheduleEnd = this.timeToMinutes(schedule.endTime);
            slots.forEach(slot => {
                const slotStart = this.timeToMinutes(slot.start);
                const slotEnd = this.timeToMinutes(slot.end);
                if (scheduleStart < slotEnd && slotStart < scheduleEnd) {
                    const key = `${slot.label}-${schedule.day}`;
                    cells[key] = `${schedule.subject} | ${schedule.sectionYear} | ${schedule.room}`;
                }
            });
        });

        const headerRow = ['<tr><th>Time</th>' + days.map(day => `<th>${day}</th>`).join('') + '</tr>'];
        const rows = slots.map(slot => {
            const cols = days.map(day => {
                const key = `${slot.label}-${day}`;
                const content = cells[key] || '';
                return `<td>${content}</td>`;
            }).join('');
            return `<tr><td class="slot-label">${slot.label}</td>${cols}</tr>`;
        });

        return `
            <div class="schedule-grid-wrapper">
                <table class="schedule-grid">
                    ${headerRow.join('')}
                    ${rows.join('')}
                </table>
            </div>
        `;
    }

    // Create a jsPDF instance from the schedule HTML element
    createPdfFromElement(element) {
        return new Promise((resolve, reject) => {
            if (!element) return reject(new Error('No element to render'));
            if (typeof html2canvas === 'undefined') return reject(new Error('html2canvas is not loaded'));

            let jsPDFClass = null;
            if (window.jspdf && window.jspdf.jsPDF) jsPDFClass = window.jspdf.jsPDF;
            else if (window.jspdf && window.jspdf.default && window.jspdf.default.jsPDF) jsPDFClass = window.jspdf.default.jsPDF;
            else if (window.jsPDF) jsPDFClass = window.jsPDF;

            if (!jsPDFClass) return reject(new Error('jsPDF is not loaded'));

            html2canvas(element, { scale: 2 }).then(canvas => {
                try {
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDFClass({ orientation: 'landscape', unit: 'pt', format: 'a4' });
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();

                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = Math.min((pageWidth - 40) / imgWidth, (pageHeight - 40) / imgHeight);
                    const renderWidth = imgWidth * ratio;
                    const renderHeight = imgHeight * ratio;
                    const x = (pageWidth - renderWidth) / 2;
                    const y = 20;

                    pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
                    resolve(pdf);
                } catch (err) {
                    reject(err);
                }
            }).catch(err => reject(err));
        });
    }

    // Open the plotted schedule as a PDF in a new tab/window
    viewSchedulePdf() {
        const container = document.getElementById('scheduleGridContainer');
        if (!container) return this.showNotification('Schedule not available to export.', 'error');
        this.createPdfFromElement(container).then(pdf => {
            try {
                pdf.output('dataurlnewwindow');
            } catch (err) {
                const url = pdf.output('bloburl');
                window.open(url, '_blank');
            }
        }).catch(err => this.showNotification('Failed to generate PDF: ' + err.message, 'error'));
    }

    // Generate PDF and trigger print dialog
    printSchedule() {
        const container = document.getElementById('scheduleGridContainer');
        if (!container) return this.showNotification('Schedule not available to print.', 'error');
        this.createPdfFromElement(container).then(pdf => {
            try {
                const url = pdf.output('bloburl');
                const w = window.open(url);
                if (!w) return this.showNotification('Unable to open print window (popup blocked).', 'error');
                // give the window time to load before printing
                setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 700);
            } catch (err) {
                this.showNotification('Failed to print PDF: ' + err.message, 'error');
            }
        }).catch(err => this.showNotification('Failed to generate PDF: ' + err.message, 'error'));
    }

    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(x => parseInt(x, 10));
        return hours * 60 + minutes;
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.innerHTML = message;
        notification.className = `notification ${type}`;
        if (type === 'success') {
            setTimeout(() => { notification.className = 'notification'; notification.innerHTML = ''; }, 3500);
        }
    }

    saveSchedules() { localStorage.setItem('schedules', JSON.stringify(this.schedules)); }
    loadSchedules() { const data = localStorage.getItem('schedules'); return data ? JSON.parse(data) : []; }

    // teachers & rooms
    saveTeachers() { localStorage.setItem('teachers', JSON.stringify(this.teachers)); }
    loadTeachers() { const d = localStorage.getItem('teachers'); return d ? JSON.parse(d) : []; }
    saveRooms() { localStorage.setItem('rooms', JSON.stringify(this.rooms)); }
    loadRooms() { const d = localStorage.getItem('rooms'); return d ? JSON.parse(d) : []; }

    renderTeacherOptions() {
        const sel = document.getElementById('teacherSelect');
        sel.innerHTML = '<option value="">-- Select Teacher --</option>' + this.teachers.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    renderRoomOptions() {
        const sel = document.getElementById('roomSelect');
        sel.innerHTML = '<option value="">-- Select Room --</option>' + this.rooms.map(r => `<option value="${r}">${r}</option>`).join('');
    }

    // remove rooms that conflict with selected time/day
    updateRoomOptions() {
        const day = document.getElementById('day').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const sel = document.getElementById('roomSelect');

        // if no time/day selected, show all
        if (!day || !startTime || !endTime) {
            this.renderRoomOptions();
            return;
        }

        const available = this.rooms.filter(r => {
            // if any existing schedule uses room r at overlapping time on same day, exclude
            return !this.schedules.some(s => s.room.toLowerCase() === r.toLowerCase() && s.day === day && this.timesOverlap(s.startTime, s.endTime, startTime, endTime));
        });

        sel.innerHTML = '<option value="">-- Select Room --</option>' + available.map(r => `<option value="${r}">${r}</option>`).join('');
        const hint = document.getElementById('roomHint');
        hint.textContent = available.length === 0 ? 'No rooms available for this time.' : 'Room list updated for selected time.';
    }
}

// Initialize the application
let manager;
document.addEventListener('DOMContentLoaded', () => {
    manager = new ScheduleManager();
});
