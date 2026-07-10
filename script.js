// Schedule Manager Application
class ScheduleManager {
    constructor() {
        this.schedules = this.loadSchedules();
        this.teachers = this.loadTeachers();
        this.rooms = this.loadRooms();
        this.subjects = this.loadSubjects();
        this.courses = this.loadCourses();
        this.subjectColors = this.loadSubjectColors();
        this.migrateSchedules();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.ensureUniqueSubjectColors();
        this.render();
        this.renderTeacherOptions();
        this.renderRoomOptions();
        this.renderSubjectOptions();
        this.renderCourseOptions();
        this.checkPrereqs();
        this.showIntroIfNeeded();
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
        const addSubjectBtn = document.getElementById('addSubjectBtn');
        if (addSubjectBtn) addSubjectBtn.addEventListener('click', () => this.handleAddSubject());
        const addCourseBtn = document.getElementById('addCourseBtn');
        if (addCourseBtn) addCourseBtn.addEventListener('click', () => this.handleAddCourse());
        document.getElementById('closeScheduleModal').addEventListener('click', () => this.hideTeacherSchedule());
        document.getElementById('teacherScheduleModal').addEventListener('click', (e) => {
            if (e.target.id === 'teacherScheduleModal') this.hideTeacherSchedule();
        });

        // PDF / Print buttons in modal
        const viewPdfBtn = document.getElementById('viewPdfBtn');
        const viewLoadBtn = document.getElementById('viewLoadBtn');
        if (viewPdfBtn) viewPdfBtn.addEventListener('click', () => this.viewSchedulePdf());
        if (viewLoadBtn) viewLoadBtn.addEventListener('click', () => this.viewTeacherLoadPdf());

        // update available rooms when day/time changes
        ['day', 'startTime', 'endTime'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updateRoomOptions());
        });

        // Re-check prerequisites when select lists change
        ['teacherSelect','subjectSelect','courseSelect','roomSelect'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.checkPrereqs());
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
        this.checkPrereqs();
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
        this.checkPrereqs();
    }

    // Subjects & Courses
    handleAddSubject() {
        const input = document.getElementById('newSubject');
        const name = input.value.trim();
        if (!name) return this.showNotification('Please enter a subject to add.', 'error');
        if (this.subjects.includes(name)) return this.showNotification('Subject already exists.', 'error');
        this.subjects.push(name);
        this.saveSubjects();
        // Ensure newly added subject receives a unique color
        this.ensureUniqueSubjectColors();
        input.value = '';
        this.renderSubjectOptions();
        this.showNotification('Subject added.', 'success');
        this.checkPrereqs();
    }

    handleAddCourse() {
        const input = document.getElementById('newCourse');
        const name = input.value.trim();
        if (!name) return this.showNotification('Please enter a course & year to add.', 'error');
        if (this.courses.includes(name)) return this.showNotification('Course already exists.', 'error');
        this.courses.push(name);
        this.saveCourses();
        input.value = '';
        this.renderCourseOptions();
        this.showNotification('Course added.', 'success');
        this.checkPrereqs();
    }

    handleAddSchedule(e) {
        e.preventDefault();

        const teacherName = document.getElementById('teacherSelect').value;
        const subject = document.getElementById('subjectSelect').value;
        const courseYear = document.getElementById('courseSelect').value;
        const day = document.getElementById('day').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const room = document.getElementById('roomSelect').value;
        const courseCode = (document.getElementById('courseCode') && document.getElementById('courseCode').value) ? document.getElementById('courseCode').value.trim() : '';
        const unitsVal = (document.getElementById('units') && document.getElementById('units').value) ? parseInt(document.getElementById('units').value, 10) : 3;
        const building = (document.getElementById('building') && document.getElementById('building').value) ? document.getElementById('building').value.trim() : '';
        const overload = (document.getElementById('overload') && document.getElementById('overload').value) ? document.getElementById('overload').value.trim() : '';

        const schedule = {
            id: Date.now(),
            teacherName,
            subject,
            courseYear,
            courseCode,
            units: unitsVal,
            building,
            overload,
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
        if (!schedule.teacherName || !schedule.subject || !schedule.courseYear || !schedule.day || !schedule.startTime || !schedule.endTime || !schedule.room) {
            return 'Please fill in all fields.';
        }

        if (schedule.startTime >= schedule.endTime) {
            return 'End time must be after start time.';
        }

        const [sh] = schedule.startTime.split(':').map(x => parseInt(x));
        const [eh, em] = schedule.endTime.split(':').map(x => parseInt(x));
        // Allow classes from 7:00 up to 21:00 (9:00 PM)
        if (sh < 7 || eh > 21 || (eh === 21 && em > 0)) {
            return 'Classes must be between 7:00 AM and 9:00 PM.';
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
        this.renderManageView();
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
                                        <th>Course &amp; Year</th>
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
                                        <td>${schedule.courseYear}</td>
                                        <td>${schedule.day}</td>
                                        <td>${this.formatTime(schedule.startTime)} - ${this.formatTime(schedule.endTime)}</td>
                                        <td>${schedule.room}</td>
                                        <td><button type="button" class="delete-btn" onclick="manager.deleteSchedule(${schedule.id})">Delete</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
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

        const grouped = {};
        this.schedules.forEach(s => {
            if (!grouped[s.teacherName]) grouped[s.teacherName] = [];
            grouped[s.teacherName].push(s);
        });

        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        Object.keys(grouped).forEach(teacher => {
            grouped[teacher].sort((a, b) => {
                const dayCompare = (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
                if (dayCompare !== 0) return dayCompare;
                const courseCompare = a.courseYear.localeCompare(b.courseYear);
                if (courseCompare !== 0) return courseCompare;
                return a.startTime.localeCompare(b.startTime);
            });
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
                    <table class="schedule-table full-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Course &amp; Year</th>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Room</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherSchedules.map(schedule => {
                                const isConflicted = conflicts.some(c => c.schedule1.id === schedule.id || c.schedule2.id === schedule.id);
                                return `
                                    <tr class="${isConflicted ? 'conflict-row' : ''}">
                                        <td>${schedule.subject}</td>
                                        <td>${schedule.courseYear}</td>
                                        <td>${schedule.day}</td>
                                        <td>${this.formatTime(schedule.startTime)} - ${this.formatTime(schedule.endTime)}</td>
                                        <td>${schedule.room}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="view-row">
                        <button type="button" class="btn-view" onclick="manager.showTeacherSchedule('${teacherName.replace(/'/g, "\\'")}')">View Timetable</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderManageView() {
        const teacherListManage = document.getElementById('teacherListManage');
        const roomListManage = document.getElementById('roomListManage');
        const subjectListManage = document.getElementById('subjectListManage');
        const courseListManage = document.getElementById('courseListManage');

        if (this.teachers.length === 0) {
            teacherListManage.innerHTML = '<p class="empty-message">No teachers added yet.</p>';
        } else {
            teacherListManage.innerHTML = this.teachers.sort((a, b) => a.localeCompare(b)).map(teacherName => {
                const count = this.schedules.filter(s => s.teacherName === teacherName).length;
                return `
                    <div class="manage-item">
                        <div>
                            <div class="manage-item-title">${teacherName}</div>
                            <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                        </div>
                        <div class="manage-actions">
                            <button type="button" class="edit-btn" onclick="manager.handleEditTeacher('${teacherName.replace(/'/g, "\\'")}')">Edit</button>
                            <button type="button" class="delete-btn" onclick="manager.handleDeleteTeacher('${teacherName.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (this.rooms.length === 0) {
            roomListManage.innerHTML = '<p class="empty-message">No rooms added yet.</p>';
        } else {
            roomListManage.innerHTML = this.rooms.sort((a, b) => a.localeCompare(b)).map(roomName => {
                const count = this.schedules.filter(s => s.room === roomName).length;
                return `
                    <div class="manage-item">
                        <div>
                            <div class="manage-item-title">${roomName}</div>
                            <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                        </div>
                        <div class="manage-actions">
                            <button type="button" class="edit-btn" onclick="manager.handleEditRoom('${roomName.replace(/'/g, "\\'")}')">Edit</button>
                            <button type="button" class="delete-btn" onclick="manager.handleDeleteRoom('${roomName.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Subjects
        if (subjectListManage) {
            if (this.subjects.length === 0) {
                subjectListManage.innerHTML = '<p class="empty-message">No subjects added yet.</p>';
            } else {
                subjectListManage.innerHTML = this.subjects.sort((a, b) => a.localeCompare(b)).map(subjectName => {
                    const count = this.schedules.filter(s => s.subject === subjectName).length;
                    return `
                        <div class="manage-item">
                            <div>
                                <div class="manage-item-title">${subjectName}</div>
                                <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                            </div>
                            <div class="manage-actions">
                                <button type="button" class="edit-btn" onclick="manager.handleEditSubject('${subjectName.replace(/'/g, "\\'")}')">Edit</button>
                                <button type="button" class="delete-btn" onclick="manager.handleDeleteSubject('${subjectName.replace(/'/g, "\\'")}')">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Courses
        if (courseListManage) {
            if (this.courses.length === 0) {
                courseListManage.innerHTML = '<p class="empty-message">No courses added yet.</p>';
            } else {
                courseListManage.innerHTML = this.courses.sort((a, b) => a.localeCompare(b)).map(courseName => {
                    const count = this.schedules.filter(s => s.courseYear === courseName).length;
                    return `
                        <div class="manage-item">
                            <div>
                                <div class="manage-item-title">${courseName}</div>
                                <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                            </div>
                            <div class="manage-actions">
                                <button type="button" class="edit-btn" onclick="manager.handleEditCourse('${courseName.replace(/'/g, "\\'")}')">Edit</button>
                                <button type="button" class="delete-btn" onclick="manager.handleDeleteCourse('${courseName.replace(/'/g, "\\'")}')">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    handleEditTeacher(oldName) {
        const newNameRaw = prompt('Enter a new name for the teacher:', oldName);
        const newName = newNameRaw ? newNameRaw.trim() : '';
        if (!newName) return;
        if (this.teachers.some(t => t.toLowerCase() === newName.toLowerCase() && t !== oldName)) {
            return this.showNotification('A teacher with that name already exists.', 'error');
        }
        const index = this.teachers.findIndex(t => t === oldName);
        if (index === -1) return;
        this.teachers[index] = newName;
        this.schedules = this.schedules.map(s => s.teacherName === oldName ? { ...s, teacherName: newName } : s);
        this.saveTeachers();
        this.saveSchedules();
        this.render();
        this.showNotification('Teacher name updated.', 'success');
    }

    handleDeleteTeacher(name) {
        const related = this.schedules.filter(s => s.teacherName === name).length;
        if (related > 0) {
            const cascade = confirm(`${name} has ${related} schedule(s). Click OK to delete the teacher and all their schedules, or Cancel to keep them.`);
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete teacher.', 'error');
            // remove schedules and teacher
            this.schedules = this.schedules.filter(s => s.teacherName !== name);
        } else {
            if (!confirm(`Delete teacher ${name}?`)) return;
        }
        this.teachers = this.teachers.filter(t => t !== name);
        this.saveTeachers();
        this.saveSchedules();
        this.render();
        this.showNotification('Teacher deleted.', 'success');
    }

    handleEditRoom(oldName) {
        const newNameRaw = prompt('Enter a new name for the room:', oldName);
        const newName = newNameRaw ? newNameRaw.trim() : '';
        if (!newName) return;
        if (this.rooms.some(r => r.toLowerCase() === newName.toLowerCase() && r !== oldName)) {
            return this.showNotification('A room with that name already exists.', 'error');
        }
        const index = this.rooms.findIndex(r => r === oldName);
        if (index === -1) return;
        this.rooms[index] = newName;
        this.schedules = this.schedules.map(s => s.room === oldName ? { ...s, room: newName } : s);
        this.saveRooms();
        this.saveSchedules();
        this.render();
        this.showNotification('Room name updated.', 'success');
    }

    handleDeleteRoom(name) {
        const related = this.schedules.filter(s => s.room === name).length;
        if (related > 0) {
            const cascade = confirm(`${name} is used in ${related} schedule(s). Click OK to delete the room and remove those schedule entries, or Cancel to keep them.`);
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete room.', 'error');
            // remove schedules that reference the room
            this.schedules = this.schedules.filter(s => s.room !== name);
        } else {
            if (!confirm(`Delete room ${name}?`)) return;
        }
        this.rooms = this.rooms.filter(r => r !== name);
        this.saveRooms();
        this.saveSchedules();
        this.render();
        this.showNotification('Room deleted.', 'success');
    }

    // Subject / Course edit/delete handlers
    handleEditSubject(oldName) {
        const newNameRaw = prompt('Enter a new name for the subject:', oldName);
        const newName = newNameRaw ? newNameRaw.trim() : '';
        if (!newName) return;
        if (this.subjects.some(s => s.toLowerCase() === newName.toLowerCase() && s !== oldName)) {
            return this.showNotification('A subject with that name already exists.', 'error');
        }
        const index = this.subjects.findIndex(s => s === oldName);
        if (index === -1) return;
        this.subjects[index] = newName;
        this.schedules = this.schedules.map(s => s.subject === oldName ? { ...s, subject: newName } : s);
        this.saveSubjects();
        this.saveSchedules();
        this.ensureUniqueSubjectColors();
        this.render();
        this.showNotification('Subject updated.', 'success');
    }

    handleDeleteSubject(name) {
        const related = this.schedules.filter(s => s.subject === name).length;
        if (related > 0) {
            const cascade = confirm(`${name} is used in ${related} schedule(s). Click OK to delete the subject and remove those schedule entries, or Cancel to keep them.`);
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete subject.', 'error');
            this.schedules = this.schedules.filter(s => s.subject !== name);
        } else {
            if (!confirm(`Delete subject ${name}?`)) return;
        }
        this.subjects = this.subjects.filter(s => s !== name);
        this.saveSubjects();
        this.saveSchedules();
        this.ensureUniqueSubjectColors();
        this.render();
        this.showNotification('Subject deleted.', 'success');
    }

    handleEditCourse(oldName) {
        const newNameRaw = prompt('Enter a new name for the course & year:', oldName);
        const newName = newNameRaw ? newNameRaw.trim() : '';
        if (!newName) return;
        if (this.courses.some(c => c.toLowerCase() === newName.toLowerCase() && c !== oldName)) {
            return this.showNotification('A course with that name already exists.', 'error');
        }
        const index = this.courses.findIndex(c => c === oldName);
        if (index === -1) return;
        this.courses[index] = newName;
        this.schedules = this.schedules.map(s => s.courseYear === oldName ? { ...s, courseYear: newName } : s);
        this.saveCourses();
        this.saveSchedules();
        this.render();
        this.showNotification('Course updated.', 'success');
    }

    handleDeleteCourse(name) {
        const related = this.schedules.filter(s => s.courseYear === name).length;
        if (related > 0) {
            const cascade = confirm(`${name} is used in ${related} schedule(s). Click OK to delete the course and remove those schedule entries, or Cancel to keep them.`);
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete course.', 'error');
            this.schedules = this.schedules.filter(s => s.courseYear !== name);
        } else {
            if (!confirm(`Delete course ${name}?`)) return;
        }
        this.courses = this.courses.filter(c => c !== name);
        this.saveCourses();
        this.saveSchedules();
        this.render();
        this.showNotification('Course deleted.', 'success');
    }

    switchView(e) {
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const viewType = e.target.dataset.view;
        document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
        document.getElementById(viewType === 'teacher' ? 'teacherView' : viewType === 'all' ? 'allView' : 'manageView').classList.add('active');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.toggle('all-view-active', viewType === 'all');
        }
    }

    showTeacherSchedule(teacherName) {
        const teacherSchedules = this.getTeacherSchedules(teacherName);

        // mark modal with current teacher for use by print/export actions
        const modal = document.getElementById('teacherScheduleModal');
        if (modal) modal.dataset.teacher = teacherName;

        // Determine days to display: default Mon-Fri, include Saturday only if teacher has classes there
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const teacherDays = new Set(teacherSchedules.map(s => s.day));
        const daysToShow = allDays.filter(d => d !== 'Saturday').filter(d => true);
        if (teacherDays.has('Saturday')) daysToShow.push('Saturday');

        // Determine display end time: show until 5pm unless teacher has classes after 5pm
        const latestEndMin = teacherSchedules.reduce((max, s) => Math.max(max, this.timeToMinutes(s.endTime)), 0);
        const defaultEnd = 17 * 60; // 5:00 PM
        const maxAllowedEnd = 21 * 60; // 9:00 PM
        let displayEnd = defaultEnd;
        if (latestEndMin > defaultEnd) displayEnd = Math.min(latestEndMin, maxAllowedEnd);

        const slots = this.generateTimeSlots().filter(slot => this.timeToMinutes(slot.start) < displayEnd);
        const grid = this.buildScheduleGrid(teacherSchedules, daysToShow, slots);

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
        // generate 30-min slots from 7:00 up to 21:00 (9:00 PM)
        while (minutes < 21 * 60) {
            const startH = Math.floor(minutes / 60);
            const startM = minutes % 60;
            const endMinutes = minutes + 30;
            const endH = Math.floor(endMinutes / 60);
            const endM = endMinutes % 60;
            const format = (h, m) => `${((h + 11) % 12) + 1}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
            const label = `${format(startH, startM)} - ${format(endH, endM)}`;
            slots.push({
                start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
                label
            });
            minutes += 30;
        }
        return slots;
    }

    buildScheduleGrid(schedules, days, slots) {
        // Build a grid that merges consecutive slots into a single cell using rowspan
        // Prepare a map for each day with slot placeholders
        const slotCount = slots.length;
        const dayCells = {};
        days.forEach(day => {
            dayCells[day] = new Array(slotCount).fill(null);
        });

        // For each schedule, compute start index and span (number of slots)
        schedules.forEach(schedule => {
            const day = schedule.day;
            if (!dayCells[day]) return; // skip days not displayed
            const scheduleStart = this.timeToMinutes(schedule.startTime);
            const scheduleEnd = this.timeToMinutes(schedule.endTime);
            // find first slot index where slot.end > scheduleStart
            let startIdx = slots.findIndex(slot => this.timeToMinutes(slot.end) > scheduleStart);
            if (startIdx === -1) return;
            // find last slot index where slot.start < scheduleEnd
            let endIdx = -1;
            for (let i = startIdx; i < slots.length; i++) {
                if (this.timeToMinutes(slots[i].start) < scheduleEnd) endIdx = i;
                else break;
            }
            if (endIdx === -1) return;
            const span = endIdx - startIdx + 1;
            // compute colors now and bake into the cell to avoid later lookup issues
            const bg = this.getColorForSubject(schedule.subject);
            const fg = this.getTextColorForBg(bg);
            const content = `
                <div class="cell-content">
                    <div class="subject">${schedule.subject}</div>
                    <div class="section">${schedule.courseYear}</div>
                    <div class="room">${schedule.room}</div>
                </div>
            `;
            // Place content at startIdx and mark following indices as skipped
            dayCells[day][startIdx] = { content, span, id: schedule.id, styleAttr: ` style="background:${bg}; color:${fg};"` };
            for (let k = startIdx + 1; k <= endIdx; k++) {
                dayCells[day][k] = { skip: true };
            }
        });

        const headerRow = ['<tr><th>Time</th>' + days.map(day => `<th>${day}</th>`).join('') + '</tr>'];
        const rows = [];
        for (let rowIdx = 0; rowIdx < slots.length; rowIdx++) {
            const cols = days.map(day => {
                const cell = dayCells[day][rowIdx];
                if (!cell) return '<td></td>';
                if (cell.skip) return '';
                const rowspanAttr = cell.span && cell.span > 1 ? ` rowspan="${cell.span}"` : '';
                const styleAttr = cell.styleAttr || '';
                return `<td${rowspanAttr}${styleAttr}>${cell.content}</td>`;
            }).join('');
            rows.push(`<tr><td class="slot-label">${slots[rowIdx].label}</td>${cols}</tr>`);
        }

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

            // Clone element and expand it so html2canvas renders the full content (not only the scrolled viewport)
            const clone = element.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.width = element.scrollWidth + 'px';
            clone.style.height = 'auto';
            clone.style.overflow = 'visible';
            document.body.appendChild(clone);
            html2canvas(clone, { scale: 2, scrollY: -window.scrollY }).then(canvas => {
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
                    // cleanup
                    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                    resolve(pdf);
                } catch (err) {
                    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                    reject(err);
                }
            }).catch(err => {
                if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                reject(err);
            });
        });
    }

    // Open the plotted schedule as a PDF in a new tab/window
    viewSchedulePdf() {
        const container = document.getElementById('scheduleGridContainer');
        if (!container) return this.showNotification('Schedule not available to export.', 'error');
        this.createPdfFromElement(container).then(pdf => {
            try {
                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (!win) {
                    this.showNotification('Popup blocked. Please allow popups or try printing instead.', 'error');
                }
            } catch (err) {
                this.showNotification('Failed to open PDF: ' + err.message, 'error');
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

    // Build a standalone element representing the teacher's load (landscape A4 style)
    generateTeacherLoadElement(teacherName) {
        const schedules = this.getTeacherSchedules(teacherName).slice().sort((a,b) => {
            const dayOrder = { 'Monday':1,'Tuesday':2,'Wednesday':3,'Thursday':4,'Friday':5,'Saturday':6 };
            const d = (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
            if (d !== 0) return d;
            if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
            return a.courseYear.localeCompare(b.courseYear);
        });

        const container = document.createElement('div');
        container.className = 'teacher-load-pdf';
        container.style.fontFamily = 'Arial, Helvetica, sans-serif';
        container.style.padding = '18px';
        container.style.color = '#222';
        container.style.background = '#fff';
        container.style.width = '1000px';

        // Header: logos and institution text on the same centered row, with title block below
        const header = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 auto 6px; font-size:11.6px; line-height:1.12; width:840px; max-width:100%;">
                <div style="flex:0 0 78px; display:flex; justify-content:center; align-items:center;">
                    <img src="assets/CSAP-LOGO.png" style="width:72px; max-width:100%; height:auto; object-fit:contain;">
                </div>
                <div style="flex:1 1 0; min-width:0; max-width:520px; text-align:center; padding:0 6px;">
                    <div style="font-weight:600;">Colegio de San Antonio de Padua, Inc.</div>
                    <div>Supervised by Lasallian School Supervision Office</div>
                    <div>Ramon M. Durano, Foundation Compound</div>
                    <div>Guinsay, Danao City</div>
                </div>
                <div style="flex:0 0 78px; display:flex; justify-content:center; align-items:center;">
                    <img src="assets/logo.png" style="width:72px; max-width:100%; height:auto; object-fit:contain;">
                </div>
            </div>

            <div style="text-align:center; margin-top:6px; margin-bottom:10px;">
                <div style="font-size:14px; font-weight:700;">COLLEGE OF ENGINEERING</div>
                <div style="font-size:13px; font-weight:700; margin-top:6px;">INSTRUCTOR'S LOAD</div>
                <div style="font-size:12px; margin-top:4px;">School Year: 2026 - 2027 (1st Semester)</div>
            </div>
        `;

        // Build table rows
        const rows = schedules.map(s => {
            // compute units (use stored units if present, otherwise default 3) and hours
            const units = (s.units !== undefined && s.units !== null) ? (parseInt(s.units, 10) || 0) : 3;
            const mins = this.timeToMinutes(s.endTime) - this.timeToMinutes(s.startTime);
            const hoursDecimal = (mins / 60).toFixed(2);
            const timeStr = `${this.formatTime(s.startTime)} - ${this.formatTime(s.endTime)}`;
            return `<tr>
                <td style="border:1px solid #000; padding:6px;">${s.courseCode || ''}</td>
                <td style="border:1px solid #000; padding:6px;">${s.subject}</td>
                <td style="border:1px solid #000; padding:6px;">${s.courseYear}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${units}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${hoursDecimal}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${s.overload || ''}</td>
                <td style="border:1px solid #000; padding:6px;">${timeStr}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${s.day}</td>
                <td style="border:1px solid #000; padding:6px;">${s.building || ''}</td>
                <td style="border:1px solid #000; padding:6px;">${s.room}</td>
            </tr>`;
        }).join('');

        // Totals (sum units/hours)
        const totalUnits = schedules.reduce((sum, s) => sum + ((s.units !== undefined && s.units !== null) ? (parseInt(s.units,10) || 0) : 3), 0);
        const totalHours = schedules.reduce((sum, s) => sum + ((this.timeToMinutes(s.endTime) - this.timeToMinutes(s.startTime)) / 60), 0).toFixed(2);

        const table = `
            <div style="margin-top:10px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div style="flex:1;">
                        <div><strong>Name of Instructor</strong> &nbsp;&nbsp;&nbsp;&nbsp;: ${teacherName}</div>
                        <div style="margin-top:6px;"><strong>Effective Date</strong> &nbsp;&nbsp;&nbsp;&nbsp;: </div>
                    </div>
                    <div style="width:320px; text-align:right;">
                        <div><strong>Regular Teaching Load</strong> &nbsp;&nbsp;: ${totalUnits}</div>
                        <div style="margin-top:6px;"><strong>Overload</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: </div>
                    </div>
                </div>

                <table style="border-collapse:collapse; width:100%; font-size:12px;">
                    <thead>
                        <tr>
                            <th style="border:1px solid #000; padding:6px;">Course Code</th>
                            <th style="border:1px solid #000; padding:6px;">Descriptive Title</th>
                            <th style="border:1px solid #000; padding:6px;">Section and Year</th>
                            <th style="border:1px solid #000; padding:6px;">Units</th>
                            <th style="border:1px solid #000; padding:6px;">No. of Hours</th>
                            <th style="border:1px solid #000; padding:6px;">Overload</th>
                            <th style="border:1px solid #000; padding:6px;">Time</th>
                            <th style="border:1px solid #000; padding:6px;">Days</th>
                            <th style="border:1px solid #000; padding:6px;">BLDG</th>
                            <th style="border:1px solid #000; padding:6px;">Room</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr>
                            <td colspan="3" style="border:1px solid #000; padding:6px; text-align:right;"><strong>TOTAL</strong></td>
                            <td style="border:1px solid #000; padding:6px; text-align:center;"><strong>${totalUnits}</strong></td>
                            <td style="border:1px solid #000; padding:6px; text-align:center;"><strong>${totalHours}</strong></td>
                            <td colspan="5" style="border:1px solid #000; padding:6px;"></td>
                        </tr>
                    </tbody>
                </table>

                <!-- Signature / footer block -->
                <div style="display:flex; justify-content:space-between; margin-top:28px; font-size:11px;">
                    <div style="width:28%; text-align:left;">
                        <div style="margin-bottom:24px;">Conformed by:</div>
                        <div style="margin-bottom:14px; display:inline-block; border-bottom:1px solid #000; width:64%; padding-bottom:3px;">&nbsp;</div>
                        <div style="margin-top:10px; font-style:italic;">Instructor</div>
                    </div>
                    <div style="width:28%; text-align:center;">
                        <div style="margin-bottom:24px;">Prepared by:</div>
                        <div style="margin-bottom:14px; display:inline-block; border-bottom:1px solid #000; width:68%; padding-bottom:3px;">ENGR. SHEM JAY M. TARIAO</div>
                        <div style="margin-top:10px; font-size:11px;">&nbsp;</div>
                    </div>
                    <div style="width:28%; text-align:center;">
                        <div style="margin-bottom:24px;">Recommending Approval</div>
                        <div style="margin-bottom:14px; display:inline-block; border-bottom:1px solid #000; width:68%; padding-bottom:3px;">DR. ALBERTO A. JUMAO-AS JR.</div>
                        <div style="margin-top:10px; font-size:11px;">VP Academics and Research</div>
                    </div>
                </div>

                <div style="display:flex; justify-content:center; gap:100px; margin-top:26px; font-size:11px;">
                    <div style="width:34%; min-width:240px; text-align:center;">
                        <div style="margin-bottom:24px;">Reviewed by:</div>
                        <div style="margin-bottom:14px; display:inline-block; border-bottom:1px solid #000; width:86%; padding-bottom:3px;">ENGR. EMMANUEL M. NADELA</div>
                        <div style="margin-top:10px; font-size:11px;">Department Dean</div>
                    </div>
                    <div style="width:34%; min-width:240px; text-align:center;">
                        <div style="margin-bottom:24px;">Approved by:</div>
                        <div style="margin-bottom:14px; display:inline-block; border-bottom:1px solid #000; width:86%; padding-bottom:3px;">DR. GENESA P. PARAGADOS</div>
                        <div style="margin-top:10px; font-size:11px;">President</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = header + table;
        return container;
    }

    // View the teacher load as PDF in a new tab
    viewTeacherLoadPdf() {
        const modal = document.getElementById('teacherScheduleModal');
        const teacher = modal && modal.dataset ? modal.dataset.teacher : null;
        if (!teacher) return this.showNotification('No teacher selected to export.', 'error');
        const el = this.generateTeacherLoadElement(teacher);
        document.body.appendChild(el);
        this.createPdfFromElement(el).then(pdf => {
            try {
                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (!win) this.showNotification('Popup blocked. Please allow popups or try printing instead.', 'error');
            } catch (err) {
                this.showNotification('Failed to open PDF: ' + err.message, 'error');
            } finally {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            }
        }).catch(err => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            this.showNotification('Failed to generate PDF: ' + err.message, 'error');
        });
    }

    // Generate PDF for teacher load and open print dialog
    printTeacherLoad() {
        const modal = document.getElementById('teacherScheduleModal');
        const teacher = modal && modal.dataset ? modal.dataset.teacher : null;
        if (!teacher) return this.showNotification('No teacher selected to print.', 'error');
        const el = this.generateTeacherLoadElement(teacher);
        document.body.appendChild(el);
        this.createPdfFromElement(el).then(pdf => {
            try {
                const url = pdf.output('bloburl');
                const w = window.open(url);
                if (!w) return this.showNotification('Unable to open print window (popup blocked).', 'error');
                setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 700);
            } catch (err) {
                this.showNotification('Failed to print PDF: ' + err.message, 'error');
            } finally {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            }
        }).catch(err => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            this.showNotification('Failed to generate PDF: ' + err.message, 'error');
        });
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

    // Migrate older stored schedules using `sectionYear` to `courseYear`
    migrateSchedules() {
        let changed = false;
        this.schedules = this.schedules.map(s => {
            if (s && s.sectionYear && !s.courseYear) {
                s.courseYear = s.sectionYear;
                delete s.sectionYear;
                changed = true;
            }
            return s;
        });
        if (changed) this.saveSchedules();
    }

    // teachers & rooms
    saveTeachers() { localStorage.setItem('teachers', JSON.stringify(this.teachers)); }
    loadTeachers() { const d = localStorage.getItem('teachers'); return d ? JSON.parse(d) : []; }
    saveRooms() { localStorage.setItem('rooms', JSON.stringify(this.rooms)); }
    loadRooms() { const d = localStorage.getItem('rooms'); return d ? JSON.parse(d) : []; }

    // subjects & courses
    saveSubjects() { localStorage.setItem('subjects', JSON.stringify(this.subjects)); }
    loadSubjects() { const d = localStorage.getItem('subjects'); return d ? JSON.parse(d) : []; }
    saveCourses() { localStorage.setItem('courses', JSON.stringify(this.courses)); }
    loadCourses() { const d = localStorage.getItem('courses'); return d ? JSON.parse(d) : []; }
    saveSubjectColors() { localStorage.setItem('subjectColors', JSON.stringify(this.subjectColors || {})); }
    loadSubjectColors() {
        const d = localStorage.getItem('subjectColors');
        if (!d) return {};
        try {
            const parsed = JSON.parse(d) || {};
            const normalized = {};
            Object.keys(parsed).forEach(k => {
                const nk = k ? k.trim() : k;
                if (!(nk in normalized)) normalized[nk] = parsed[k];
            });
            return normalized;
        } catch (e) {
            return {};
        }
    }

    // color palette and assignment
    getColorForSubject(name) {
        if (!name) return null;
        const key = name.trim();
        if (!this.subjectColors) this.subjectColors = {};
        if (this.subjectColors[key]) return this.subjectColors[key];
        const palette = [
            '#ffd6a5','#fdffb6','#caffbf','#9bf6ff','#a0c4ff','#bdb2ff','#ffc6ff','#ffadad','#bde0fe','#d0f4de'
        ];
        // deterministic assignment: hash name to palette index, but avoid duplicates
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
        const preferredIdx = Math.abs(hash) % palette.length;
        const usedColors = Object.values(this.subjectColors || {});
        // prefer the hashed color if not used yet
        let color = palette[preferredIdx];
        if (usedColors.includes(color)) {
            // find first palette color that's not used
            const available = palette.find(c => !usedColors.includes(c));
            if (available) color = available;
            else {
                // palette exhausted; generate a distinct HSL-based color
                const hue = Math.abs(hash) % 360;
                color = (function(h,s,l){
                    s /= 100; l /= 100;
                    const k = n => (n + h/30) % 12;
                    const a = s * Math.min(l, 1 - l);
                    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
                    const r = Math.round(255 * f(0));
                    const g = Math.round(255 * f(8));
                    const b = Math.round(255 * f(4));
                    const toHex = v => v.toString(16).padStart(2, '0');
                    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                })(hue, 65, 75);
            }
        }
        this.subjectColors[key] = color;
        this.saveSubjectColors();
        return color;
    }

    // choose readable text color based on background
    getTextColorForBg(bg) {
        if (!bg) return '#000';
        // compute luminance
        const c = bg.replace('#','');
        const r = parseInt(c.substring(0,2),16);
        const g = parseInt(c.substring(2,4),16);
        const b = parseInt(c.substring(4,6),16);
        const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
        return luminance > 0.6 ? '#000' : '#fff';
    }

    // Ensure each distinct subject has a unique color assignment
    ensureUniqueSubjectColors() {
        if (!this.subjects) this.subjects = [];
        if (!this.subjectColors) this.subjectColors = this.loadSubjectColors() || {};
        const palette = [
            '#ffd6a5','#fdffb6','#caffbf','#9bf6ff','#a0c4ff','#bdb2ff','#ffc6ff','#ffadad','#bde0fe','#d0f4de'
        ];
        const used = new Set();
        // First pass: keep any existing mapping for subjects present, but mark used colors
        this.subjects.forEach(s => {
            const key = s ? s.trim() : s;
            const col = this.subjectColors[key];
            if (col && !used.has(col)) used.add(col);
        });
        // Second pass: assign colors to subjects missing a mapping or colliding
        // Iterate subjects in alphabetical order for determinism
        this.subjects.slice().sort((a,b)=>a.localeCompare(b)).forEach(s => {
            const key = s ? s.trim() : s;
            let col = this.subjectColors[key];
            if (!col || (col && Array.from(used).filter(c => c === col).length > 1)) {
                // find first palette color not yet used
                const avail = palette.find(c => !used.has(c));
                if (avail) {
                    col = avail;
                } else {
                    // generate HSL-based color using golden angle to spread hues
                    const hue = (used.size * 137.508) % 360;
                    const s_v = 65;
                    const l_v = 70;
                    const h = Math.round(hue);
                    // convert hsl to hex
                    const hex = (function(h,s,l){
                        s /= 100; l /= 100;
                        const c = (1 - Math.abs(2*l - 1)) * s;
                        const x = c * (1 - Math.abs((h/60)%2 - 1));
                        const m = l - c/2;
                        let r=0,g=0,b=0;
                        if (0<=h && h<60){ r=c; g=x; b=0; }
                        else if (60<=h && h<120){ r=x; g=c; b=0; }
                        else if (120<=h && h<180){ r=0; g=c; b=x; }
                        else if (180<=h && h<240){ r=0; g=x; b=c; }
                        else if (240<=h && h<300){ r=x; g=0; b=c; }
                        else { r=c; g=0; b=x; }
                        const toHex = v => Math.round((v + m)*255).toString(16).padStart(2,'0');
                        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                    })(h, s_v, l_v);
                    col = hex;
                }
                this.subjectColors[key] = col;
                used.add(col);
            } else {
                // existing mapping and unique — ensure marked used
                used.add(col);
            }
        });
        this.saveSubjectColors();
    }

    renderTeacherOptions() {
        const sel = document.getElementById('teacherSelect');
        sel.innerHTML = '<option value="">-- Select Teacher --</option>' + this.teachers.slice().sort((a,b)=>a.localeCompare(b)).map(t => `<option value="${t}">${t}</option>`).join('');
    }

    renderSubjectOptions() {
        const sel = document.getElementById('subjectSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Subject --</option>' + this.subjects.slice().sort((a,b)=>a.localeCompare(b)).map(s => `<option value="${s}">${s}</option>`).join('');
    }

    renderCourseOptions() {
        const sel = document.getElementById('courseSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Course & Year --</option>' + this.courses.slice().sort((a,b)=>a.localeCompare(b)).map(c => `<option value="${c}">${c}</option>`).join('');
    }

    renderRoomOptions() {
        const sel = document.getElementById('roomSelect');
        sel.innerHTML = '<option value="">-- Select Room --</option>' + this.rooms.slice().sort((a,b)=>a.localeCompare(b)).map(r => `<option value="${r}">${r}</option>`).join('');
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

        // sort available rooms
        const sortedAvailable = available.slice().sort((a,b)=>a.localeCompare(b));
        sel.innerHTML = '<option value="">-- Select Room --</option>' + sortedAvailable.map(r => `<option value="${r}">${r}</option>`).join('');
        const hint = document.getElementById('roomHint');
        hint.textContent = available.length === 0 ? 'No rooms available for this time.' : 'Room list updated for selected time.';
    }

    showIntroIfNeeded() {
        try {
            const seen = localStorage.getItem('seenIntro');
            if (seen === 'true') return;
            const modal = document.getElementById('introModal');
            if (!modal) return;
            modal.style.display = 'flex';
            const btn = document.getElementById('introDismissBtn');
            const chk = document.getElementById('introDontShow');
            const closeFn = () => {
                if (chk && chk.checked) localStorage.setItem('seenIntro', 'true');
                modal.style.display = 'none';
            };
            if (btn) btn.addEventListener('click', closeFn, { once: true });
            const manageBtn = document.getElementById('introManageBtn');
            if (manageBtn) manageBtn.addEventListener('click', () => {
                closeFn();
                // open Manage Lists view
                const toggle = document.querySelector('[data-view="manage"]');
                if (toggle) toggle.click();
            });
        } catch (e) {
            // ignore
        }
    }

    // Enable or disable the schedule form submit depending on whether prerequisite lists exist
    checkPrereqs() {
        const btn = document.querySelector('#scheduleForm .btn-add');
        const ok = this.teachers.length > 0 && this.subjects.length > 0 && this.courses.length > 0 && this.rooms.length > 0;
        if (btn) {
            btn.disabled = !ok;
            btn.title = ok ? '' : 'Please add teachers, subjects, courses & rooms before plotting schedules.';
        }
    }
}

// Initialize the application
let manager;
document.addEventListener('DOMContentLoaded', () => {
    manager = new ScheduleManager();
});
