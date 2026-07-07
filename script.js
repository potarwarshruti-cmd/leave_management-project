document.addEventListener('DOMContentLoaded', () => {
    // --- FINAL VERSION ---
    // This file controls the main index.html app after login.

    // --- Global State & DOM Elements ---
    let currentUser;
    let allRequests = [];
    let allProfiles = [];
    let allNotifications = [];

    const appContainer = document.getElementById('app-container');
    const appNav = document.getElementById('app-nav');
    const appMain = document.getElementById('app-main');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Modals
    const profileModal = document.getElementById('profileModal');
    const profileForm = document.getElementById('profile-form');
    const previewModal = document.getElementById('previewModal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('#previewModal .close-btn');

    // --- Data Helper Functions ---
    function loadDataFromStorage() {
        currentUser = JSON.parse(localStorage.getItem('currentUser'));
        allRequests = JSON.parse(localStorage.getItem('leaveRequests')) || [];
        allProfiles = JSON.parse(localStorage.getItem('studentProfiles')) || [];
        allNotifications = JSON.parse(localStorage.getItem('notifications')) || [];
    }

    function saveDataToStorage() {
        localStorage.setItem('leaveRequests', JSON.stringify(allRequests));
        localStorage.setItem('studentProfiles', JSON.stringify(allProfiles));
        localStorage.setItem('notifications', JSON.stringify(allNotifications));
    }

    // --- 1. Authentication & Initialization ---
    
    function checkAuth() {
        loadDataFromStorage();
        if (!currentUser) {
            // Not logged in, redirect to login page
            window.location.href = 'login.html';
            return;
        }

        // Logged in, show the app
        appContainer.style.display = 'block';
        initializeApp();
    }

    function initializeApp() {
        // Check if student user has a profile
        if (currentUser.role === 'student') {
            const userProfile = allProfiles.find(p => p.email === currentUser.email);
            if (!userProfile) {
                // Force profile creation
                profileModal.style.display = 'block';
            } else {
                // Load student dashboard
                renderStudentUI();
            }
        } else if (currentUser.role === 'admin') {
            // Load admin dashboard
            renderAdminUI();
        }

        // Setup common event listeners
        logoutBtn.addEventListener('click', handleLogout);
        profileForm.addEventListener('submit', handleProfileSave);
        closeModalBtn.onclick = () => { previewModal.style.display = 'none'; };
        window.onclick = (e) => {
            if (e.target == previewModal) previewModal.style.display = 'none';
        };
    }

    function handleLogout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }

    // --- 2. Profile Management ---

    // --- KEY FIX (Robust Version) ---
    // This function now correctly handles both cases:
    // 1. User uploads a profile picture.
    // 2. User does NOT upload a profile picture.
    // This ensures renderStudentUI() is always called, fixing the "empty page" bug.

    function handleProfileSave(e) {
        e.preventDefault();

        // This is a new, safer "inner" function.
        // It runs *after* the file has been (or not been) handled.
        const saveProfileData = (profilePicUrl) => {
            const newProfile = {
                email: currentUser.email,
                name: document.getElementById('profile-name').value,
                urn: document.getElementById('profile-urn').value,
                dob: document.getElementById('profile-dob').value,
                year: document.getElementById('profile-year').value,
                division: document.getElementById('profile-division').value,
                contact: document.getElementById('profile-contact').value,
                parentContact: document.getElementById('profile-parent-contact').value,
                abcId: document.getElementById('profile-abc-id').value,
                profilePic: profilePicUrl || null // Use the file data or null
            };

            // Check if profile already exists to update it, otherwise add new
            const existingIndex = allProfiles.findIndex(p => p.email === currentUser.email);
            if (existingIndex > -1) {
                allProfiles[existingIndex] = newProfile;
            } else {
                allProfiles.push(newProfile);
            }
            
            saveDataToStorage();
            
            profileModal.style.display = 'none';
            profileForm.reset();

            // --- THIS IS THE CRITICAL LINE THAT NOW WORKS ---
            renderStudentUI(); // Load the UI now that profile is saved
        };


        // --- This is the new file-handling logic ---
        const picFile = document.getElementById('profile-pic').files[0];

        if (picFile) {
            // If user uploaded a file...
            const reader = new FileReader();
            reader.onloadend = () => {
                // 1. Read the file
                // 2. Then, call the inner function with the file data
                saveProfileData(reader.result);
            };
            reader.readAsDataURL(picFile); // Convert image to Base64
        } else {
            // If user did NOT upload a file...
            // 1. Call the inner function immediately with 'null'
            saveProfileData(null);
        }
    }


    // --- 3. Student UI & Functionality ---

    function renderStudentUI() {
        appNav.innerHTML = `
            <button class="tab-btn active" data-target="apply-leave">Apply for Leave</button>
            <button class="tab-btn" data-target="my-status">My Leave Status</button>
            <button class="tab-btn" data-target="my-profile">My Profile</button>
            <button class="tab-btn" data-target="my-inbox">My Inbox <span class="badge pending" id="inbox-count"></span></button>
        `;
        
        appMain.innerHTML = `
            <div id="apply-leave" class="portal-content active">
                <h2>Submit a Leave Request</h2>
                <form id="leave-form">
                    <div class="form-group-row">
                        <div class="form-group">
                            <label for="from-date">From Date</label>
                            <input type="date" id="from-date" required>
                        </div>
                        <div class="form-group">
                            <label for="to-date">To Date</label>
                            <input type="date" id="to-date" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="leave-reason">Reason for Leave</label>
                        <textarea id="leave-reason" rows="4" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="certificate-upload">Upload Medical Certificate (PDF/Image)</label>
                        <input type="file" id="certificate-upload" accept=".jpg,.jpeg,.png,.pdf">
                    </div>
                    <button type="submit" class="btn submit-btn">Submit Request</button>
                </form>
            </div>
            <div id="my-status" class="portal-content">
                <h2>My Leave Status</h2>
                <div id="student-request-list"></div>
            </div>
            <div id="my-profile" class="portal-content">
                <h2>My Profile</h2>
                <div id="profile-view"></div>
            </div>
            <div id="my-inbox" class="portal-content">
                <h2>My Inbox (Notifications)</h2>
                <div id="inbox-list"></div>
            </div>
        `;
        
        // Add event listeners for new UI
        appNav.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', switchTab);
        });
        
        document.getElementById('leave-form').addEventListener('submit', handleLeaveSubmit);

        // Load content for the default tab (Apply Leave)
        // We'll also pre-load the other tabs' content so it's ready
        renderStudentStatus();
        renderStudentProfile();
        renderStudentInbox();
    }
    
    function switchTab(e) {
        // Switch active tab button
        if(appNav.querySelector('.tab-btn.active')) {
            appNav.querySelector('.tab-btn.active').classList.remove('active');
        }
        e.target.classList.add('active');
        
        // Switch active content pane
        if(appMain.querySelector('.portal-content.active')) {
            appMain.querySelector('.portal-content.active').classList.remove('active');
        }
        const targetId = e.target.dataset.target;
        document.getElementById(targetId).classList.add('active');

        // Special refresh actions on tab switch
        if (targetId === 'my-status') renderStudentStatus();
        if (targetId === 'my-profile') renderStudentProfile();
        if (targetId === 'my-inbox') renderStudentInbox();
    }

    function handleLeaveSubmit(e) {
        e.preventDefault();
        
        // Get profile to link name and roll
        const profile = allProfiles.find(p => p.email === currentUser.email);
        if (!profile) {
            alert('Error: Could not find your profile. Please try logging out and in again.');
            return;
        }

        const file = document.getElementById('certificate-upload').files[0];
        const reader = new FileReader();

        reader.onloadend = () => {
            const newRequest = {
                id: Date.now(),
                studentEmail: currentUser.email,
                name: profile.name, // From profile
                roll: profile.urn,   // From profile (URN)
                from: document.getElementById('from-date').value,
                to: document.getElementById('to-date').value,
                reason: document.getElementById('leave-reason').value,
                certificate: reader.result,
                status: 'pending'
            };

            allRequests.push(newRequest);
            saveDataToStorage();
            
            alert('Leave request submitted successfully!');
            document.getElementById('leave-form').reset();
            
            // Optionally switch to status tab
            appNav.querySelector('[data-target="my-status"]').click();
        };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            reader.onloadend(); // Submit without file
        }
    }
    
    function renderStudentStatus() {
        const listEl = document.getElementById('student-request-list');
        const myRequests = allRequests.filter(req => req.studentEmail === currentUser.email);
        
        if (myRequests.length === 0) {
            listEl.innerHTML = '<p>You have not submitted any leave requests.</p>';
            return;
        }

        listEl.innerHTML = myRequests.map(req => `
            <div class="leave-card">
                <div class="card-header">
                    <h3>Reason: ${req.reason}</h3>
                    <span class="badge ${req.status}">${req.status}</span>
                </div>
                <div class="card-body">
                    <p><strong>From:</strong> ${req.from}</p>
                    <p><strong>To:</strong> ${req.to}</p>
                </div>
            </div>
        `).join('');
    }

    function renderStudentProfile() {
        const profile = allProfiles.find(p => p.email === currentUser.email);
        const viewEl = document.getElementById('profile-view');
        
        if (!profile) return; // Should not happen if profile modal worked

        // Use a default pic if none is saved
        const profilePic = profile.profilePic || 'https://via.placeholder.com/150/007bff/FFFFFF?text=USER';

        viewEl.innerHTML = `
            <div class="student-card">
                <img src="${profilePic}" alt="Profile Picture" class="student-pic">
                <div class="student-details">
                    <h3>${profile.name}</h3>
                    <p><strong>Email:</strong> ${profile.email}</p>
                    <p><strong>URN:</strong> ${profile.urn}</p>
                    <p><strong>DOB:</strong> ${profile.dob}</p>
                    <p><strong>Year:</strong> ${profile.year} | <strong>Division:</strong> ${profile.division}</p>
                    <p><strong>Contact:</strong> ${profile.contact}</p>
                    <p><strong>Parent's Contact:</strong> ${profile.parentContact}</p>
                    <p><strong>ABC ID:</strong> ${profile.abcId}</p>
                </div>
            </div>
        `;
    }

    function renderStudentInbox() {
        const listEl = document.getElementById('inbox-list');
        const myNotifications = allNotifications
            .filter(n => n.studentEmail === currentUser.email)
            .sort((a, b) => b.id - a.id); // Show newest first

        const unreadCount = myNotifications.filter(n => !n.read).length;
        const countEl = document.getElementById('inbox-count');
        if (countEl) {
            countEl.textContent = unreadCount > 0 ? unreadCount : '';
        }
        
        if (myNotifications.length === 0) {
            listEl.innerHTML = '<p>You have no new notifications.</p>';
            return;
        }

        listEl.innerHTML = myNotifications.map(n => `
            <div class="inbox-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                <strong>${n.subject}</strong>
                <p>${n.message}</p>
                <small>${new Date(n.id).toLocaleString()}</small>
            </div>
        `).join('');

        // Mark as read when clicked
        listEl.querySelectorAll('.inbox-item.unread').forEach(item => {
            item.addEventListener('click', () => {
                const notif = allNotifications.find(n => n.id == item.dataset.id);
                if (notif) {
                    notif.read = true;
                    item.classList.remove('unread');
                    saveDataToStorage();
                    renderStudentInbox(); // Refresh count
                }
            });
        });
    }

    // --- 4. Admin UI & Functionality ---

    function renderAdminUI() {
        appNav.innerHTML = `
            <button class="tab-btn active" data-target="admin-dashboard">Dashboard</button>
            <button class="tab-btn" data-target="all-students">All Students</button>
        `;

        appMain.innerHTML = `
            <div id="admin-dashboard" class="portal-content active">
                <h2>Admin Dashboard</h2>
                <div class="stats-container">
                    <div class="stat-card">
                        <h3>Total Applications</h3>
                        <p id="stat-total-req"></p>
                    </div>
                    <div class="stat-card">
                        <h3>Pending Requests</h3>
                        <p id="stat-pending-req"></p>
                    </div>
                    <div class="stat-card">
                        <h3>Total Students</h3>
                        <p id="stat-total-std"></p>
                    </div>
                </div>
                <div class="filters">
                    <label for="filter-status">Filter by status:</label>
                    <select id="filter-status">
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button id="exportCsvBtn" class="btn export-btn">Export to CSV</button>
                </div>
                <div id="request-list"></div>
            </div>
            <div id="all-students" class="portal-content">
                <h2>All Registered Students</h2>
                <div id="student-list"></div>
            </div>
        `;
        
        // Add event listeners
        appNav.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', switchTab);
        });
        
        document.getElementById('filter-status').addEventListener('change', renderAdminDashboard); // Changed to re-render all
        document.getElementById('exportCsvBtn').addEventListener('click', exportToCsv);
        document.getElementById('request-list').addEventListener('click', handleAdminActions);

        // Load default content
        renderAdminDashboard();
        renderAllStudents();
    }
    
    function renderAdminDashboard() {
        // Update Stats
        document.getElementById('stat-total-req').textContent = allRequests.length;
        document.getElementById('stat-pending-req').textContent = allRequests.filter(r => r.status === 'pending').length;
        document.getElementById('stat-total-std').textContent = allProfiles.length;
        
        // Render requests
        renderAdminRequests();
    }

    function renderAdminRequests() {
        const listEl = document.getElementById('request-list');
        const filterValue = document.getElementById('filter-status').value;

        const filteredRequests = allRequests.filter(req => 
            filterValue === 'all' || req.status === filterValue
        );

        if (filteredRequests.length === 0) {
            listEl.innerHTML = '<p>No leave requests found for this filter.</p>';
            return;
        }

        listEl.innerHTML = filteredRequests.map(req => {
            const certButtonDisabled = req.certificate ? '' : 'disabled';
            const certButtonText = req.certificate ? 'View Certificate' : 'No Certificate';
            return `
            <div class="leave-card">
                <div class="card-header">
                    <h3>${req.name} (URN: ${req.roll})</h3>
                    <span class="badge ${req.status}">${req.status}</span>
                </div>
                <div class="card-body">
                    <p><strong>Email:</strong> ${req.studentEmail}</p>
                    <p><strong>From:</strong> ${req.from}</p>
                    <p><strong>To:</strong> ${req.to}</p>
                </div>
                <div class="card-actions">
                    <button class="btn action-btn view-cert-btn" data-id="${req.id}" ${certButtonDisabled}>
                        ${certButtonText}
                    </button>
                    <button class="btn action-btn approve-btn" data-id="${req.id}" ${req.status !== 'pending' ? 'disabled' : ''}>Approve</button>
                    <button class="btn action-btn reject-btn" data-id="${req.id}" ${req.status !== 'pending' ? 'disabled' : ''}>Reject</button>
                </div>
                <div class="card-reason">
                    <strong>Reason:</strong> ${req.reason}
                </div>
            </div>
            `;
        }).join('');
    }
    
    function renderAllStudents() {
        const listEl = document.getElementById('student-list');
        
        if (allProfiles.length === 0) {
            listEl.innerHTML = '<p>No students have registered yet.</p>';
            return;
        }

        listEl.innerHTML = allProfiles.map(p => {
            // Use a default pic if none is saved
            const profilePic = p.profilePic || 'https://via.placeholder.com/100/007bff/FFFFFF?text=USER';
            return `
            <div class="student-card">
                <img src="${profilePic}" alt="Profile Picture" class="student-pic">
                <div class="student-details">
                    <h3>${p.name}</h3>
                    <p><strong>URN:</strong> ${p.urn} | <strong>Year:</strong> ${p.year} | <strong>Div:</strong> ${p.division}</p>
                    <p><strong>Email:</strong> ${p.email}</p>
                    <p><strong>Contact:</strong> ${p.contact} | <strong>Parent's:</strong> ${p.parentContact}</p>
                </div>
            </div>
        `;}).join('');
    }

    function handleAdminActions(e) {
        const id = e.target.dataset.id;
        if (!id) return;
        const req = allRequests.find(r => r.id == id);
        if (!req) return;

        if (e.target.classList.contains('approve-btn')) {
            updateStatus(req, 'approved');
        } else if (e.target.classList.contains('reject-btn')) {
            updateStatus(req, 'rejected');
        } else if (e.target.classList.contains('view-cert-btn')) {
            viewCertificate(req);
        }
    }

    function updateStatus(request, newStatus) {
        request.status = newStatus;
        
        // --- Create Simulated Email Notification ---
        const notif = {
            id: Date.now(),
            studentEmail: request.studentEmail,
            read: false,
            subject: `Leave Request ${newStatus}`,
            message: `Your leave request for ${request.from} to ${request.to} has been ${newStatus}.`
        };
        allNotifications.push(notif);
        // --- End of Simulation ---

        saveDataToStorage();
        renderAdminDashboard(); // Re-render admin list
    }

    function viewCertificate(request) {
        const base64String = request.certificate;
        if (!base64String) return;

        modalBody.innerHTML = '';
        if (base64String.startsWith('data:image')) {
            modalBody.innerHTML = `<img src="${base64String}" alt="Certificate">`;
        } else if (base64String.startsWith('data:application/pdf')) {
            modalBody.innerHTML = `<iframe src="${base64String}" style="width:100%; height:100%; border:none;"></iframe>`;
        }
        previewModal.style.display = 'block';
    }


    // --- 5. CSV Export ---
    
    function escapeCsvCell(cell) {
        if (cell == null) {
            return ''; // Handle null or undefined
        }
        cell = String(cell);
        if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    }

    function exportToCsv() {
        if (allRequests.length === 0) {
            alert('No data to export.');
            return;
        }
        const headers = ["ID", "Student Name", "Student Email", "URN", "From Date", "To Date", "Reason", "Status", "Certificate Uploaded"];
        let csvContent = headers.join(",") + "\n";

        allRequests.forEach(req => {
            const certUploaded = req.certificate ? "Yes" : "No";
            const row = [req.id, req.name, req.studentEmail, req.roll, req.from, req.to, req.reason, req.status, certUploaded];
            csvContent += row.map(escapeCsvCell).join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "leave_requests_export.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }


    // --- Run the App ---
    checkAuth();
});